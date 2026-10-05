import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { legeSuperadminAn } from "../../db/superadmin-anlegen.js";
import { verifyPassword } from "../../auth/password.js";
import {
  loescheTestSuperadmin,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
const eigentuemer = new pg.Pool({
  connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
});

const email = `befehl-${crypto.randomUUID()}@example.test`;
const emailCli = `befehl-cli-${crypto.randomUUID()}@example.test`;
const backendWurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

after(async () => {
  await loescheTestSuperadmin(email);
  await loescheTestSuperadmin(emailCli);
  await eigentuemer.end();
  await schliesseTestVerbindungen();
});

// Startet den Befehl als eigenen Prozess und gibt seinen Exit-Code und Text zurück.
function befehl(eingaben) {
  return new Promise((resolve) => {
    const kind = spawn(process.execPath, ["src/db/superadmin-anlegen.js"], {
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

test("Befehl legt einen Superadmin ohne Firma an, Passwort muss geändert werden", async () => {
  const { passwort } = await legeSuperadminAn(eigentuemer, { email, name: "Test Superadmin" });

  const { rows } = await eigentuemer.query(
    "SELECT firma_id, rolle, muss_passwort_aendern, passwort_hash FROM users WHERE email = $1",
    [email]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].firma_id, null);
  assert.equal(rows[0].rolle, "Superadmin");
  assert.equal(rows[0].muss_passwort_aendern, true);
  assert.equal(await verifyPassword(passwort, rows[0].passwort_hash), true);
  assert.ok(passwort.length >= 12, "Startpasswort ist zu kurz");
});

test("Zweiter Aufruf mit derselben E-Mail schlägt sauber fehl", async () => {
  await assert.rejects(
    legeSuperadminAn(eigentuemer, { email, name: "Doppelt" }),
    (err) => {
      assert.match(err.message, /bereits ein Konto/);
      return true;
    }
  );
});

test("Ungültige E-Mail und leerer Name werden abgelehnt", async () => {
  await assert.rejects(legeSuperadminAn(eigentuemer, { email: "kein-mail", name: "X" }), /gültige E-Mail/);
  await assert.rejects(legeSuperadminAn(eigentuemer, { email: "x@y.de", name: "  " }), /Namen/);
});

test("Der Befehl im Terminal legt an und zeigt das Passwort einmal an; zweiter Aufruf endet mit Fehler", async () => {
  const erster = await befehl([emailCli, "CLI Test"]);
  assert.equal(erster.code, 0, erster.ausgabe);
  assert.match(erster.ausgabe, /Startpasswort:\s+\S{12,}/);

  const zweiter = await befehl([emailCli, "CLI Test"]);
  assert.equal(zweiter.code, 1);
  assert.match(zweiter.ausgabe, /Abbruch: .*bereits ein Konto/);
});
