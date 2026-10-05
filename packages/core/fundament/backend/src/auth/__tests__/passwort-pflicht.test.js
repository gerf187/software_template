import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { hashPassword } from "../../auth/password.js";
import {
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

// Startpasswort-Pflicht gilt auch für die API, nicht nur im Frontend (B2),
// und eine Passwortänderung beendet die übrigen Sitzungen dieses Nutzers (B3).

const ALT = "Startpasswort-Pflicht-Test-1";
const NEU = "Gruener-Tiger-Wolke-7429";
const firmaId = await erstelleTestfirmaMitRechten("Passwort Pflicht");
const email = `pflicht-${crypto.randomUUID()}@example.test`;

await withFirma(firmaId, async (client) => {
  const hash = await hashPassword(ALT);
  await client.query(
    `INSERT INTO users (firma_id, email, passwort_hash, name, rolle, muss_passwort_aendern)
     VALUES ($1, $2, $3, 'Pflicht', 'Admin', true)`,
    [firmaId, email, hash]
  );
});

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestfirma(firmaId);
  await schliesseTestVerbindungen();
  await pool.end();
});

async function login(passwort) {
  const res = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwort }),
  });
  return { status: res.status, cookie: res.headers.get("set-cookie") };
}

function api(cookie, method, path, body) {
  return fetch(`${basis}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

test("Solange das Startpasswort gilt, ist die Fach-API gesperrt (403), Ändern und Abmelden gehen", async () => {
  const anmeldung = await login(ALT);
  assert.equal(anmeldung.status, 200);
  assert.equal(anmeldung.cookie === null, false);

  const kontakte = await api(anmeldung.cookie, "GET", "/api/kontakte");
  assert.equal(kontakte.status, 403, "Fach-API muss vor der Passwortänderung gesperrt sein");

  const me = await api(anmeldung.cookie, "GET", "/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal((await me.json()).mussPasswortAendern, true);

  const aendern = await api(anmeldung.cookie, "POST", "/api/auth/passwort-aendern", {
    aktuellesPasswort: ALT,
    neuesPasswort: NEU,
  });
  assert.equal(aendern.status, 200);

  const danach = await api(anmeldung.cookie, "GET", "/api/kontakte");
  assert.equal(danach.status, 200, "nach der Änderung ist die API wieder frei");
});

test("Passwortänderung beendet die übrigen Sitzungen, die aktuelle bleibt", async () => {
  const erste = await login(NEU);
  const zweite = await login(NEU);
  assert.equal(erste.status, 200);
  assert.equal(zweite.status, 200);

  const aendern = await api(zweite.cookie, "POST", "/api/auth/passwort-aendern", {
    aktuellesPasswort: NEU,
    neuesPasswort: "Anderer-Tiger-Wolke-8531",
  });
  assert.equal(aendern.status, 200);

  assert.equal((await api(erste.cookie, "GET", "/api/auth/me")).status, 401, "andere Sitzung muss ende sein");
  assert.equal((await api(zweite.cookie, "GET", "/api/auth/me")).status, 200, "aktuelle Sitzung bleibt");
});
