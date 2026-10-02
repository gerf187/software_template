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

const PASSWORT = "Ein-Sicheres-Passwort-12";

async function erstelleBenutzer(firmaId, email, rolle) {
  const hash = await hashPassword(PASSWORT);
  const rows = await withFirma(firmaId, (client) =>
    client
      .query(
        "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, $4, $4) RETURNING id",
        [firmaId, email, hash, rolle]
      )
      .then((r) => r.rows)
  );
  return rows[0].id;
}

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

async function login(email, passwort = PASSWORT) {
  const res = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwort }),
  });
  return { res, cookie: res.headers.get("set-cookie"), daten: await res.json() };
}

function api(cookie, method, path, body) {
  return fetch(`${basis}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const firmaA = await erstelleTestfirmaMitRechten("Dashboard Test A");
const firmaB = await erstelleTestfirmaMitRechten("Dashboard Test B");

const emailAdminA = `admin-a-${crypto.randomUUID()}@example.test`;
const emailAdminB = `admin-b-${crypto.randomUUID()}@example.test`;

await erstelleBenutzer(firmaA, emailAdminA, "Admin");
await erstelleBenutzer(firmaB, emailAdminB, "Admin");

after(async () => {
  server.close();
  await loescheTestfirma(firmaA);
  await loescheTestfirma(firmaB);
  await schliesseTestVerbindungen();
  await pool.end();
});

const { cookie: cookieAdminA } = await login(emailAdminA);
const { cookie: cookieAdminB } = await login(emailAdminB);

const kontaktRes = await api(cookieAdminA, "POST", "/api/kontakte", {
  vorname: "Max",
  nachname: "Mustermann",
});
const kontakt = await kontaktRes.json();

await api(cookieAdminA, "POST", `/api/kontakte/${kontakt.id}/aufgaben`, {
  text: "Rückruf vereinbaren",
  faelligAm: "2026-01-01",
});

test("Ohne Anmeldung gibt es 401", async () => {
  const res = await api(null, "GET", "/api/dashboard");
  assert.equal(res.status, 401);
});

test("Dashboard zeigt Kontakt-Anzahl und offene Aufgabe von Firma A", async () => {
  const res = await api(cookieAdminA, "GET", "/api/dashboard");
  assert.equal(res.status, 200);
  const daten = await res.json();
  assert.equal(daten.anzahlKontakte, 1);
  assert.equal(daten.anzahlOffenerAufgaben, 1);
  assert.equal(daten.aufgaben.length, 1);
  assert.equal(daten.aufgaben[0].text, "Rückruf vereinbaren");
  assert.equal(daten.aufgaben[0].kontaktName, "Max Mustermann");
  assert.equal(daten.aufgaben[0].kontaktId, kontakt.id);
});

test("Mandanten-Trennung: Firma B sieht nichts von Firma A", async () => {
  const res = await api(cookieAdminB, "GET", "/api/dashboard");
  const daten = await res.json();
  assert.equal(daten.anzahlKontakte, 0);
  assert.equal(daten.anzahlOffenerAufgaben, 0);
  assert.deepEqual(daten.aufgaben, []);
});

test("Erledigte Aufgaben erscheinen nicht mehr", async () => {
  const liste = await (await api(cookieAdminA, "GET", `/api/kontakte/${kontakt.id}/aufgaben`)).json();
  await api(cookieAdminA, "PATCH", `/api/kontakte/${kontakt.id}/aufgaben/${liste[0].id}`, {
    erledigt: true,
  });

  const res = await api(cookieAdminA, "GET", "/api/dashboard");
  const daten = await res.json();
  assert.equal(daten.anzahlOffenerAufgaben, 0);
  assert.deepEqual(daten.aufgaben, []);
});
