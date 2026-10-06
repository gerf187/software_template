import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { hashPassword } from "../password.js";
import {
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

// Leerzeichen am Anfang oder Ende eines Passworts (z. B. durch Einfügen aus einer
// Nachricht) dürfen weder beim Anmelden noch beim Passwortwechsel stören.

const PASSWORT = "Gutes-Passwort-Zeile-42";
const firmaId = await erstelleTestfirmaMitRechten("Leerzeichen");
const email = `leer-${firmaId}@example.test`;
await withFirma(firmaId, async (client) => {
  const hash = await hashPassword(PASSWORT);
  await client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Leer', 'User')",
    [firmaId, email, hash]
  );
});

const server = createApp({ appName: "energieberater", production: false }).listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestfirma(firmaId);
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

test("Anmelden mit Leerzeichen am Rand klappt", async () => {
  const res = await api("POST", "/api/auth/login", { body: { email, passwort: `  ${PASSWORT} ` } });
  assert.equal(res.status, 200);
});

test("Passwortwechsel: altes Passwort mit Leerzeichen am Rand wird bereinigt", async () => {
  const anmeldung = await api("POST", "/api/auth/login", { body: { email, passwort: PASSWORT } });
  const cookie = anmeldung.headers.get("set-cookie")?.split(";")[0];
  const neu = "Neues-Sauberes-Zeichen-6612";
  const res = await api("POST", "/api/auth/passwort-aendern", {
    cookie,
    body: { aktuellesPasswort: ` ${PASSWORT}  `, neuesPasswort: neu },
  });
  assert.equal(res.status, 200);
  const mitNeu = await api("POST", "/api/auth/login", { body: { email, passwort: neu } });
  assert.equal(mitNeu.status, 200);
});

test("Neues Passwort mit Leerzeichen am Rand wird mit klarer Meldung abgelehnt", async () => {
  // Der Test davor hat das Passwort schon geändert: aktuell ist jetzt das neue.
  const aktuell = "Neues-Sauberes-Zeichen-6612";
  const anmeldung = await api("POST", "/api/auth/login", { body: { email, passwort: aktuell } });
  const cookie = anmeldung.headers.get("set-cookie")?.split(";")[0];
  const res = await api("POST", "/api/auth/passwort-aendern", {
    cookie,
    body: { aktuellesPasswort: aktuell, neuesPasswort: " Neues-Leer-Zeichen-7741 " },
  });
  assert.equal(res.status, 400);
  assert.equal(
    (await res.json()).error,
    "Das neue Passwort darf nicht mit einem Leerzeichen beginnen oder enden."
  );
});
