import { test, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { hashPassword } from "../password.js";
import {
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

// Der Erst-Wechsel ohne altes Passwort gilt nur in der Sitzung, die mit dem
// Startpasswort angemeldet wurde, und nur 60 Minuten nach diesem Login.
// Danach gilt der normale Wechsel mit altem Passwort.

const START = "Startpasswort-Fenster-Zeile-31";
const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
const eigentuemer = new pg.Client({
  connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
});
await eigentuemer.connect();

const firmaId = await erstelleTestfirmaMitRechten("Erstwechsel Fenster");
const email = `fenster-${firmaId}@example.test`;
await withFirma(firmaId, async (client) => {
  const hash = await hashPassword(START);
  await client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle, muss_passwort_aendern) VALUES ($1, $2, $3, 'Fenster', 'User', true)",
    [firmaId, email, hash]
  );
});

const server = createApp({ appName: "energieberater", production: false }).listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestfirma(firmaId);
  await eigentuemer.end();
  await schliesseTestVerbindungen();
  await pool.end();
});

function api(method, pfad, { cookie, body } = {}) {
  return fetch(`${basis}${pfad}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: basis, ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function anmelden() {
  const res = await api("POST", "/api/auth/login", { body: { email, passwort: START } });
  return res.headers.get("set-cookie")?.split(";")[0];
}

test("Innerhalb von 60 Minuten nach dem Startpasswort-Login: Erst-Wechsel ohne altes Passwort", async () => {
  const cookie = await anmelden();
  const me = await (await api("GET", "/api/auth/me", { cookie })).json();
  assert.equal(me.erstwechselMoeglich, true);
  const res = await api("POST", "/api/auth/passwort-aendern", {
    cookie,
    body: { neuesPasswort: "Erstes-Neues-Zeichen-4410" },
  });
  assert.equal(res.status, 200);
});

test("Nach 60 Minuten: ohne altes Passwort wird abgelehnt, mit Startpasswort geht es", async () => {
  // Neue Sitzung, dann das Erstellungsdatum um 61 Minuten zurücksetzen.
  const pw = "Erstes-Neues-Zeichen-4410";
  const anmeldung = await api("POST", "/api/auth/login", { body: { email, passwort: pw } });
  const cookie = anmeldung.headers.get("set-cookie")?.split(";")[0];
  await eigentuemer.query(
    "UPDATE sessions SET created_at = now() - interval '61 minutes' WHERE user_id = (SELECT id FROM users WHERE email = $1)",
    [email]
  );
  const me = await (await api("GET", "/api/auth/me", { cookie })).json();
  assert.equal(me.erstwechselMoeglich, false);

  const ohne = await api("POST", "/api/auth/passwort-aendern", {
    cookie,
    body: { neuesPasswort: "Zweites-Neues-Zeichen-5521" },
  });
  assert.equal(ohne.status, 400);

  const mit = await api("POST", "/api/auth/passwort-aendern", {
    cookie,
    body: { aktuellesPasswort: pw, neuesPasswort: "Zweites-Neues-Zeichen-5521" },
  });
  assert.equal(mit.status, 200);
});
