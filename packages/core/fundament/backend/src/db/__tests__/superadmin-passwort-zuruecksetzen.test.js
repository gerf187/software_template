import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { setzeSuperadminPasswortZurueck } from "../superadmin-passwort-zuruecksetzen.js";
import { verifyPassword, hashPassword } from "../../auth/password.js";
import {
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  erstelleTestSuperadmin,
  loescheTestSuperadmin,
  schliesseTestVerbindungen,
} from "./helpers.js";

const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
const eigentuemer = new pg.Pool({
  connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
});

const email = `zuruecksetzen-${crypto.randomUUID()}@example.test`;
const emailCli = `zuruecksetzen-cli-${crypto.randomUUID()}@example.test`;
const emailAdmin = `zuruecksetzen-admin-${crypto.randomUUID()}@example.test`;
const backendWurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

let firmaAdmin;

after(async () => {
  await loescheTestSuperadmin(email);
  await loescheTestSuperadmin(emailCli);
  if (firmaAdmin) await loescheTestfirma(firmaAdmin);
  await eigentuemer.end();
  await schliesseTestVerbindungen();
});

function befehl(eingaben) {
  return new Promise((resolve) => {
    const kind = spawn(process.execPath, ["src/db/superadmin-passwort-zuruecksetzen.js"], {
      cwd: backendWurzel,
      env: process.env,
    });
    let ausgabe = "";
    kind.stdout.on("data", (d) => (ausgabe += d));
    kind.stderr.on("data", (d) => (ausgabe += d));
    kind.on("close", (code) => resolve({ code, ausgabe }));
    kind.stdin.end(eingaben.join("\n") + "\n");
  });
}

test("Setzt ein neues Startpasswort, beendet Sitzungen und Fehlversuche, protokolliert", async () => {
  await erstelleTestSuperadmin(email, await hashPassword("Ein-Altes-Kennwort-12"));

  // Vorher: eine "laufende Sitzung" und ein Fehlversuch simulieren.
  const { rows } = await eigentuemer.query("SELECT id FROM users WHERE email = $1", [email]);
  const userId = rows[0].id;
  await eigentuemer.query(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')`,
    [crypto.randomUUID(), userId]
  );
  await eigentuemer.query(
    "INSERT INTO login_versuche (email, erfolgreich) VALUES ($1, false)",
    [email]
  );

  const vorherAnzahlSessions = await eigentuemer.query("SELECT count(*)::int AS n FROM sessions WHERE user_id = $1", [userId]);
  assert.equal(vorherAnzahlSessions.rows[0].n, 1);

  const { passwort } = await setzeSuperadminPasswortZurueck(eigentuemer, { email });
  assert.ok(passwort.length >= 12, "Startpasswort ist zu kurz");

  const nachher = await eigentuemer.query(
    "SELECT passwort_hash, muss_passwort_aendern FROM users WHERE id = $1",
    [userId]
  );
  assert.equal(nachher.rows[0].muss_passwort_aendern, true);
  assert.equal(await verifyPassword(passwort, nachher.rows[0].passwort_hash), true);

  const sessionsNachher = await eigentuemer.query("SELECT count(*)::int AS n FROM sessions WHERE user_id = $1", [userId]);
  assert.equal(sessionsNachher.rows[0].n, 0, "Laufende Sitzungen müssen sofort beendet sein");

  const fehlversucheNachher = await eigentuemer.query(
    "SELECT count(*)::int AS n FROM login_versuche WHERE lower(email) = lower($1) AND erfolgreich = false",
    [email]
  );
  assert.equal(fehlversucheNachher.rows[0].n, 0, "Login-Fehlversuche müssen zurückgesetzt sein");

  const protokoll = await eigentuemer.query(
    "SELECT aktion, user_id, ziel_email FROM plattform_protokoll WHERE ziel_email = $1",
    [email]
  );
  assert.equal(protokoll.rows.length, 1);
  assert.equal(protokoll.rows[0].aktion, "superadmin_passwort_zuruecksetzen");
  assert.equal(protokoll.rows[0].user_id, userId);
});

test("Unbekannte E-Mail-Adresse wird abgelehnt", async () => {
  await assert.rejects(
    setzeSuperadminPasswortZurueck(eigentuemer, { email: "unbekannt@example.test" }),
    /Kein Superadmin-Konto/
  );
});

test("Firmen-Admin kann damit nicht zurückgesetzt werden", async () => {
  firmaAdmin = await erstelleTestfirmaMitRechten("Zurücksetzen-Test (Admin)");
  await eigentuemer.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Admin', 'Admin')",
    [firmaAdmin, emailAdmin, await hashPassword("Ein-Admin-Kennwort-12")]
  );

  await assert.rejects(
    setzeSuperadminPasswortZurueck(eigentuemer, { email: emailAdmin }),
    /Kein Superadmin-Konto/
  );
});

test("Der Befehl im Terminal fragt die E-Mail ab und zeigt das neue Passwort einmal an", async () => {
  await erstelleTestSuperadmin(emailCli, await hashPassword("Ein-Weiteres-Kennwort-12"));

  const ergebnis = await befehl([emailCli]);
  assert.equal(ergebnis.code, 0, ergebnis.ausgabe);
  assert.match(ergebnis.ausgabe, /Startpasswort:\s+\S{12,}/);
});
