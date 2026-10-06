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

// Gesperrte Firma: richtiges Passwort bekommt eine eigene Meldung. Falsches Passwort
// bleibt bei der allgemeinen Meldung, damit nichts über Konten verraten wird.

const PASSWORT = "Gesperrt-Passwort-Zeile-77";
const SPERRE = "Ihr Zugang ist gesperrt. Bitte wenden Sie sich an den Anbieter.";
const firmaId = await erstelleTestfirmaMitRechten("Gesperrt Meldung");
const email = `gesperrt-${firmaId}@example.test`;
await withFirma(firmaId, async (client) => {
  const hash = await hashPassword(PASSWORT);
  await client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Gesperrt', 'Admin')",
    [firmaId, email, hash]
  );
});

const server = createApp({ appName: "energieberater", production: false }).listen(0);
const basis = `http://localhost:${server.address().port}`;

async function firmaAktiv(aktiv) {
  await pool.query("UPDATE firmen SET aktiv = $2 WHERE id = $1", [firmaId, aktiv]);
}

after(async () => {
  server.close();
  await firmaAktiv(true);
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

test("Gesperrte Firma: richtiges Passwort bekommt die Sperr-Meldung (403)", async () => {
  await firmaAktiv(false);
  const res = await api("POST", "/api/auth/login", { body: { email, passwort: PASSWORT } });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, SPERRE);
  await firmaAktiv(true);
});

test("Gesperrte Firma: falsches Passwort bleibt bei der allgemeinen Meldung (401)", async () => {
  await firmaAktiv(false);
  const res = await api("POST", "/api/auth/login", { body: { email, passwort: "Falsch-Falsch-Zeichen-99" } });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, "E-Mail oder Passwort falsch.");
  await firmaAktiv(true);
});

test("Laufende Sitzung wird bei Sperre mit derselben Meldung beendet (403)", async () => {
  const anmeldung = await api("POST", "/api/auth/login", { body: { email, passwort: PASSWORT } });
  assert.equal(anmeldung.status, 200);
  const cookie = anmeldung.headers.get("set-cookie")?.split(";")[0];

  await firmaAktiv(false);
  const res = await api("GET", "/api/auth/me", { cookie });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, SPERRE);
  await firmaAktiv(true);
});
