import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import { createApp } from "../../app.js";
import { deaktiviereSuperadmin } from "../superadmin-deaktivieren.js";
import { hashPassword } from "../../auth/password.js";
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

const PASSWORT = "Ein-Sicheres-Kennwort-12";
const emailA = `deaktivieren-a-${crypto.randomUUID()}@example.test`;
const emailB = `deaktivieren-b-${crypto.randomUUID()}@example.test`;
const emailAdmin = `deaktivieren-admin-${crypto.randomUUID()}@example.test`;
const emailSitzung = `deaktivieren-sitzung-${crypto.randomUUID()}@example.test`;

let firmaAdmin;
const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestSuperadmin(emailA);
  await loescheTestSuperadmin(emailB);
  await loescheTestSuperadmin(emailSitzung);
  if (firmaAdmin) await loescheTestfirma(firmaAdmin);
  await eigentuemer.end();
  await schliesseTestVerbindungen();
});

async function login(email, passwort) {
  const res = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwort }),
  });
  return { res, cookie: res.headers.get("set-cookie"), daten: await res.json() };
}

test("Deaktiviert ein Konto, solange noch ein anderes aktiv bleibt", async () => {
  await erstelleTestSuperadmin(emailA, await hashPassword(PASSWORT));
  await erstelleTestSuperadmin(emailB, await hashPassword(PASSWORT));

  await deaktiviereSuperadmin(eigentuemer, { email: emailA });

  const { rows } = await eigentuemer.query("SELECT aktiv FROM users WHERE email = $1", [emailA]);
  assert.equal(rows[0].aktiv, false);

  const protokoll = await eigentuemer.query(
    "SELECT aktion FROM plattform_protokoll WHERE ziel_email = $1",
    [emailA]
  );
  assert.equal(protokoll.rows[0].aktion, "superadmin_deaktiviert");
});

test("Schon deaktiviertes Konto wird abgelehnt", async () => {
  await assert.rejects(deaktiviereSuperadmin(eigentuemer, { email: emailA }), /schon deaktiviert/);
});

test("Unbekannte E-Mail-Adresse wird abgelehnt", async () => {
  await assert.rejects(
    deaktiviereSuperadmin(eigentuemer, { email: "unbekannt@example.test" }),
    /Kein Superadmin-Konto/
  );
});

test("Firmen-Admin kann damit nicht deaktiviert werden", async () => {
  firmaAdmin = await erstelleTestfirmaMitRechten("Deaktivieren-Test (Admin)");
  await eigentuemer.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Admin', 'Admin')",
    [firmaAdmin, emailAdmin, await hashPassword(PASSWORT)]
  );

  await assert.rejects(
    deaktiviereSuperadmin(eigentuemer, { email: emailAdmin }),
    /Kein Superadmin-Konto/
  );
});

test("Letzter aktiver Superadmin kann nicht deaktiviert werden", async () => {
  // Komplett in einer eigenen, nie committeten Transaktion: andere parallel
  // laufende Tests legen selbst Superadmin-Konten an, darum werden hier alle
  // AUSSER dem eigenen Testkonto nur innerhalb dieser Transaktion (nicht
  // dauerhaft!) deaktiviert -- ROLLBACK am Ende macht alles ungeschehen,
  // ohne andere Tests zu beeinflussen.
  const client = await eigentuemer.connect();
  try {
    await client.query("BEGIN");
    await erstelleTestSuperadmin(emailB + "-letzter", await hashPassword(PASSWORT));
    await client.query(
      "UPDATE users SET aktiv = false WHERE rolle = 'Superadmin' AND aktiv = true AND email <> $1",
      [emailB + "-letzter"]
    );
    await assert.rejects(
      deaktiviereSuperadmin(client, { email: emailB + "-letzter" }),
      /letzte aktive Superadmin-Konto/
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("Deaktiviertes Konto kann sich nicht mehr anmelden, laufende Sitzung wird sofort ungültig", async () => {
  await erstelleTestSuperadmin(emailSitzung, await hashPassword(PASSWORT));
  await erstelleTestSuperadmin(emailSitzung + "-zweiter", await hashPassword(PASSWORT));

  const { cookie } = await login(emailSitzung, PASSWORT);
  const voherMe = await fetch(`${basis}/api/auth/me`, { headers: { cookie } });
  assert.equal(voherMe.status, 200);

  await deaktiviereSuperadmin(eigentuemer, { email: emailSitzung });

  const nachherMe = await fetch(`${basis}/api/auth/me`, { headers: { cookie } });
  assert.equal(nachherMe.status, 401, "Alte Sitzung muss sofort ungültig sein");

  const neuerLogin = await login(emailSitzung, PASSWORT);
  assert.equal(neuerLogin.res.status, 401, "Deaktiviertes Konto darf sich nicht mehr anmelden");

  await loescheTestSuperadmin(emailSitzung + "-zweiter");
});
