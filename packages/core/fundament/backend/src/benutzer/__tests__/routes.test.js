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

// Zwei Firmen für den Trennungstest (Abschnitt 6, Pflicht-Test).
const firmaA = await erstelleTestfirmaMitRechten("Benutzer-Routen Test A");
const firmaB = await erstelleTestfirmaMitRechten("Benutzer-Routen Test B");

const emailAdminA = `admin-a-${crypto.randomUUID()}@example.test`;
const emailMitarbeiterA = `mitarbeiter-a-${crypto.randomUUID()}@example.test`;
const emailBetrachterA = `betrachter-a-${crypto.randomUUID()}@example.test`;
const emailAdminB = `admin-b-${crypto.randomUUID()}@example.test`;

await erstelleBenutzer(firmaA, emailAdminA, "Admin");
await erstelleBenutzer(firmaA, emailMitarbeiterA, "Mitarbeiter");
await erstelleBenutzer(firmaA, emailBetrachterA, "Betrachter");
const idAdminB = await erstelleBenutzer(firmaB, emailAdminB, "Admin");

after(async () => {
  server.close();
  await loescheTestfirma(firmaA);
  await loescheTestfirma(firmaB);
  await schliesseTestVerbindungen();
  await pool.end();
});

const { cookie: cookieAdminA } = await login(emailAdminA);
const { cookie: cookieMitarbeiterA } = await login(emailMitarbeiterA);
const { cookie: cookieBetrachterA } = await login(emailBetrachterA);
const { cookie: cookieAdminB } = await login(emailAdminB);

test("Mitarbeiter und Betrachter sehen die Benutzerverwaltung nicht", async () => {
  const resMitarbeiter = await api(cookieMitarbeiterA, "GET", "/api/benutzer");
  assert.equal(resMitarbeiter.status, 403);

  const resBetrachter = await api(cookieBetrachterA, "GET", "/api/benutzer");
  assert.equal(resBetrachter.status, 403);
});

test("Admin kann einen Benutzer einladen, Startpasswort kommt einmalig zurück", async () => {
  const email = `neu-${crypto.randomUUID()}@example.test`;
  const res = await api(cookieAdminA, "POST", "/api/benutzer", {
    name: "Neuer Mitarbeiter",
    email,
    rolle: "Mitarbeiter",
  });
  assert.equal(res.status, 201);
  const daten = await res.json();
  assert.ok(daten.startpasswort);
  assert.equal(daten.muss_passwort_aendern, true);
  assert.equal(daten.aktiv, true);
});

test("E-Mail-Adresse ist installationsweit eindeutig", async () => {
  const res = await api(cookieAdminA, "POST", "/api/benutzer", {
    name: "Doppelt",
    email: emailMitarbeiterA,
    rolle: "Mitarbeiter",
  });
  assert.equal(res.status, 400);
});

test("Admin kann die Rolle eines anderen Benutzers ändern", async () => {
  const liste = await (await api(cookieAdminA, "GET", "/api/benutzer")).json();
  const betrachter = liste.find((u) => u.email === emailBetrachterA);

  const res = await api(cookieAdminA, "PUT", `/api/benutzer/${betrachter.id}`, {
    name: betrachter.name,
    email: betrachter.email,
    rolle: "Mitarbeiter",
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).rolle, "Mitarbeiter");

  // Zurücksetzen für spätere Tests.
  await api(cookieAdminA, "PUT", `/api/benutzer/${betrachter.id}`, {
    name: betrachter.name,
    email: betrachter.email,
    rolle: "Betrachter",
  });
});

test("Admin kann einen Benutzer archivieren und reaktivieren", async () => {
  const liste = await (await api(cookieAdminA, "GET", "/api/benutzer")).json();
  const mitarbeiter = liste.find((u) => u.email === emailMitarbeiterA);

  const archivieren = await api(cookieAdminA, "PATCH", `/api/benutzer/${mitarbeiter.id}/aktiv`, {
    aktiv: false,
  });
  assert.equal(archivieren.status, 200);
  assert.equal((await archivieren.json()).aktiv, false);

  const loginVersuch = await login(emailMitarbeiterA);
  assert.equal(loginVersuch.res.status, 401);

  const reaktivieren = await api(cookieAdminA, "PATCH", `/api/benutzer/${mitarbeiter.id}/aktiv`, {
    aktiv: true,
  });
  assert.equal(reaktivieren.status, 200);
  assert.equal((await reaktivieren.json()).aktiv, true);
});

test("Admin kann sich nicht selbst archivieren oder herabstufen", async () => {
  const liste = await (await api(cookieAdminA, "GET", "/api/benutzer")).json();
  const sichSelbst = liste.find((u) => u.email === emailAdminA);

  const archivieren = await api(cookieAdminA, "PATCH", `/api/benutzer/${sichSelbst.id}/aktiv`, {
    aktiv: false,
  });
  assert.equal(archivieren.status, 400);

  const herabstufen = await api(cookieAdminA, "PUT", `/api/benutzer/${sichSelbst.id}`, {
    name: sichSelbst.name,
    email: sichSelbst.email,
    rolle: "Mitarbeiter",
  });
  assert.equal(herabstufen.status, 400);
});

test("Letzter Admin einer Firma bleibt geschützt", async () => {
  // Solange zwei Admins da sind, darf einer den anderen archivieren.
  const idZweiterAdmin = await erstelleBenutzer(
    firmaB,
    `admin-b-2-${crypto.randomUUID()}@example.test`,
    "Admin"
  );
  const zweiterAdminEmail = await withFirma(firmaB, (client) =>
    client.query("SELECT email FROM users WHERE id = $1", [idZweiterAdmin]).then((r) => r.rows[0].email)
  );
  const { cookie: cookieZweiterAdmin } = await login(zweiterAdminEmail);

  const archivieren = await api(cookieZweiterAdmin, "PATCH", `/api/benutzer/${idAdminB}/aktiv`, {
    aktiv: false,
  });
  assert.equal(archivieren.status, 200);

  // Jetzt ist der zweite Admin der letzte aktive -- der Selbstschutz
  // verhindert, dass er sich selbst herabstuft (der letzte Admin verschwindet
  // so in jedem Fall nie, egal ob über die Selbst- oder die Letzter-Admin-Regel).
  const herabstufen = await api(cookieZweiterAdmin, "PUT", `/api/benutzer/${idZweiterAdmin}`, {
    name: "Zweiter Admin",
    email: `admin-b-2-${crypto.randomUUID()}@example.test`,
    rolle: "Mitarbeiter",
  });
  assert.equal(herabstufen.status, 400);
});

test("Mandanten-Trennung: Admin von Firma A sieht und ändert keine Benutzer von Firma B", async () => {
  const liste = await (await api(cookieAdminA, "GET", "/api/benutzer")).json();
  assert.ok(!liste.some((u) => u.email === emailAdminB));

  const res = await api(cookieAdminA, "PUT", `/api/benutzer/${idAdminB}`, {
    name: "Fremdzugriff",
    email: emailAdminB,
    rolle: "Mitarbeiter",
  });
  assert.equal(res.status, 404);

  const resArchiv = await api(cookieAdminA, "PATCH", `/api/benutzer/${idAdminB}/aktiv`, {
    aktiv: false,
  });
  assert.equal(resArchiv.status, 404);
});
