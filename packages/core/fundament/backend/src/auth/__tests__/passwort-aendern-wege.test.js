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

// Zwei Wege: Erst-Passwortwechsel (muss_passwort_aendern) fragt das Startpasswort
// nicht noch einmal ab -- der Nutzer hat sich gerade damit angemeldet. Der freiwillige
// Wechsel fragt das alte Passwort weiterhin ab.

const START = "Startpasswort-Zeile-Sieben-19";
const ALT = "Eigenes-Altes-Zeichen-4471";
const firmaId = await erstelleTestfirmaMitRechten("Passwort Wege");

async function legeNutzerAn(email, muss) {
  const hash = await hashPassword(muss ? START : ALT);
  await withFirma(firmaId, (client) =>
    client.query(
      "INSERT INTO users (firma_id, email, passwort_hash, name, rolle, muss_passwort_aendern) VALUES ($1, $2, $3, 'Nutzer', 'User', $4)",
      [firmaId, email, hash, muss]
    )
  );
}
const emailMuss = `muss-${firmaId}@example.test`;
const emailFrei = `frei-${firmaId}@example.test`;
await legeNutzerAn(emailMuss, true);
await legeNutzerAn(emailFrei, false);

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

async function login(email, passwort) {
  const res = await api("POST", "/api/auth/login", { body: { email, passwort } });
  return { status: res.status, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}

test("Erst-Passwortwechsel ohne altes Passwort klappt, wenn muss_passwort_aendern gilt", async () => {
  const anmeldung = await login(emailMuss, START);
  assert.equal(anmeldung.status, 200);
  const res = await api("POST", "/api/auth/passwort-aendern", {
    cookie: anmeldung.cookie,
    body: { neuesPasswort: "Neues-Erstes-Zeichen-8820" },
  });
  assert.equal(res.status, 200);
  assert.equal((await login(emailMuss, "Neues-Erstes-Zeichen-8820")).status, 200);
});

test("Freiwilliger Wechsel ohne altes Passwort wird abgelehnt", async () => {
  const anmeldung = await login(emailFrei, ALT);
  const res = await api("POST", "/api/auth/passwort-aendern", {
    cookie: anmeldung.cookie,
    body: { neuesPasswort: "Neues-Freiwillig-Zeichen-5530" },
  });
  assert.equal(res.status, 400);
});

test("Freiwilliger Wechsel mit falschem altem Passwort wird abgelehnt", async () => {
  const anmeldung = await login(emailFrei, ALT);
  const res = await api("POST", "/api/auth/passwort-aendern", {
    cookie: anmeldung.cookie,
    body: { aktuellesPasswort: "Falsch-Falsch-Zeichen-1234", neuesPasswort: "Neues-Freiwillig-Zeichen-5530" },
  });
  assert.equal(res.status, 401);
});
