import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { hashPassword } from "../../auth/password.js";
import {
  erstelleTestSuperadmin,
  loescheTestSuperadmin,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

// Startpasswort-Pflicht gilt auch für den Superadmin (B2). Er hat keine Firma,
// deshalb läuft seine Sitzungsprüfung über superadmin_lookup, nicht über die
// Firmen-Abfrage -- dieser Pfad muss das Pflicht-Flag ebenfalls kennen.

const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
const eigentuemer = new pg.Pool({
  connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
});

const PASSWORT = "Superadmin-Pflicht-Test-4471";
const email = `sa-pflicht-${crypto.randomUUID()}@example.test`;

const saId = await erstelleTestSuperadmin(email, await hashPassword(PASSWORT));
await eigentuemer.query("UPDATE users SET muss_passwort_aendern = true WHERE id = $1", [saId]);

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestSuperadmin(email);
  await eigentuemer.end();
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Superadmin mit Startpasswort: Plattform-API ist gesperrt (403), /me meldet die Pflicht", async () => {
  const login = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwort: PASSWORT }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");

  const me = await fetch(`${basis}/api/auth/me`, { headers: { cookie } });
  assert.equal((await me.json()).mussPasswortAendern, true, "/me muss die Pflicht melden");

  const firmen = await fetch(`${basis}/api/superadmin/firmen`, { headers: { cookie } });
  assert.equal(firmen.status, 403, "Plattform-API muss vor dem Passwortwechsel gesperrt sein");
});
