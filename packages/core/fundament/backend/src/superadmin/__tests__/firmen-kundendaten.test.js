import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { hashPassword } from "../../auth/password.js";
import {
  erstelleTestSuperadmin,
  loescheTestSuperadmin,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

const KUNDENDATEN = {
  strasse: "Teststraße 1",
  plz: "12345",
  ort: "Teststadt",
  ansprechpartner: "Ansprechpartner Test",
  rechnungsEmail: "rechnung@example.test",
};

const emailSuperadmin = `superadmin-kundendaten-${crypto.randomUUID()}@example.test`;
await erstelleTestSuperadmin(emailSuperadmin, await hashPassword("Ein-Sicheres-Passwort-12"));

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;
const angelegteFirmen = [];

after(async () => {
  server.close();
  for (const id of angelegteFirmen) {
    await loescheTestfirma(id);
  }
  await loescheTestSuperadmin(emailSuperadmin);
  await schliesseTestVerbindungen();
  await pool.end();
});

async function login(email, passwort) {
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

const { cookie: cookieSuperadmin } = await login(emailSuperadmin, "Ein-Sicheres-Passwort-12");

test("Firma ohne Straße schlägt fehl", async () => {
  const res = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Ohne Straße ${crypto.randomUUID()}`,
    ...KUNDENDATEN,
    strasse: "",
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Straße/);
});

test("Firma mit ungültiger PLZ schlägt fehl", async () => {
  const res = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Ungültige PLZ ${crypto.randomUUID()}`,
    ...KUNDENDATEN,
    plz: "123",
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /PLZ/);
});

test("Firma mit ungültiger Rechnungs-E-Mail schlägt fehl", async () => {
  const res = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Ungültige E-Mail ${crypto.randomUUID()}`,
    ...KUNDENDATEN,
    rechnungsEmail: "keine-email",
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Rechnungs-E-Mail/);
});

test("Neue Firmen bekommen eine eindeutige, aufsteigende Kundennummer (K-0001 …)", async () => {
  const eindeutig = crypto.randomUUID();
  const erste = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Kundennummer Eins ${eindeutig}`,
    ...KUNDENDATEN,
  });
  const ersteFirma = await erste.json();
  angelegteFirmen.push(ersteFirma.id);

  const zweite = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Kundennummer Zwei ${eindeutig}`,
    ...KUNDENDATEN,
  });
  const zweiteFirma = await zweite.json();
  angelegteFirmen.push(zweiteFirma.id);

  assert.match(ersteFirma.kundennummer, /^K-\d{4}$/);
  assert.match(zweiteFirma.kundennummer, /^K-\d{4}$/);
  assert.ok(
    Number(zweiteFirma.kundennummer.slice(2)) > Number(ersteFirma.kundennummer.slice(2)),
    "Kundennummern müssen aufsteigend vergeben werden"
  );
});

test("Anlegen mit Bausteinen und erstem Admin funktioniert in einem Schritt", async () => {
  const eindeutig = crypto.randomUUID();
  const adminEmail = `admin-einschritt-${eindeutig}@example.test`;

  const res = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Ein-Schritt-Firma ${eindeutig}`,
    ...KUNDENDATEN,
    module: ["beispiel"],
    admin: { name: "Neuer Admin", email: adminEmail },
  });
  assert.equal(res.status, 201);
  const firma = await res.json();
  angelegteFirmen.push(firma.id);

  assert.ok(firma.admin);
  assert.ok(firma.admin.startpasswort.length >= 12);

  const module = await api(cookieSuperadmin, "GET", `/api/superadmin/firmen/${firma.id}/module`);
  const moduleDaten = await module.json();
  assert.ok(moduleDaten.find((m) => m.name === "beispiel" && m.aktiv === true));

  const { daten: loginDaten } = await login(adminEmail, firma.admin.startpasswort);
  assert.equal(loginDaten.mussPasswortAendern, true);
  assert.equal(loginDaten.rolle, "Admin");

  // Teil A, Punkt 1 (Bugfix): die Firmenliste zeigt die Namen der aktiven
  // Bausteine -- vorher immer leer, weil die Zählung ohne Mandanten-Bezug
  // lief und die Mandanten-Trennung (RLS) sich selbst aussperrte.
  const liste = await api(cookieSuperadmin, "GET", "/api/superadmin/firmen");
  const eigeneZeile = (await liste.json()).find((f) => f.id === firma.id);
  assert.deepEqual(eigeneZeile.bausteine, ["Beispiel"]);
});

test("Firmenliste zeigt 'keine Bausteine' als leere Liste, nicht als Fehler", async () => {
  const eindeutig = crypto.randomUUID();
  const res = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Ohne-Bausteine-Firma ${eindeutig}`,
    ...KUNDENDATEN,
  });
  const firma = await res.json();
  angelegteFirmen.push(firma.id);

  const liste = await api(cookieSuperadmin, "GET", "/api/superadmin/firmen");
  const eigeneZeile = (await liste.json()).find((f) => f.id === firma.id);
  assert.deepEqual(eigeneZeile.bausteine, []);
});

test("Firma mit ungültiger USt-IdNr. schlägt fehl, leer bleibt erlaubt", async () => {
  const eindeutig = crypto.randomUUID();
  const falsch = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Falsche USt-IdNr ${eindeutig}`,
    ...KUNDENDATEN,
    ustIdNr: "ATU12345678",
  });
  assert.equal(falsch.status, 400);
  assert.match((await falsch.json()).error, /USt-IdNr/);

  const leer = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Leere USt-IdNr ${eindeutig}`,
    ...KUNDENDATEN,
    ustIdNr: "",
  });
  assert.equal(leer.status, 201);
  const firma = await leer.json();
  angelegteFirmen.push(firma.id);

  const bearbeiten = await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firma.id}`, {
    ustIdNr: "falsch",
  });
  assert.equal(bearbeiten.status, 400);
  assert.match((await bearbeiten.json()).error, /USt-IdNr/);

  const korrekt = await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firma.id}`, {
    ustIdNr: "DE123456789",
  });
  assert.equal(korrekt.status, 200);
  assert.equal((await korrekt.json()).ust_id_nr, "DE123456789");
});

test("Erster Admin ist optional -- ohne Admin entsteht nur die Firma mit Bausteinen", async () => {
  const eindeutig = crypto.randomUUID();
  const res = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Ohne-Admin-Firma ${eindeutig}`,
    ...KUNDENDATEN,
    module: ["beispiel"],
  });
  assert.equal(res.status, 201);
  const firma = await res.json();
  angelegteFirmen.push(firma.id);
  assert.equal(firma.admin, null);

  const { rows } = await pool.query("SELECT count(*)::int AS n FROM users WHERE firma_id = $1", [firma.id]);
  assert.equal(rows[0].n, 0);
});

test("Schlägt ein Teil fehl (Admin-E-Mail schon vergeben), wird gar nichts angelegt", async () => {
  const eindeutig = crypto.randomUUID();
  const wiederverwendeteEmail = `doppelt-${eindeutig}@example.test`;

  const erste = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Transaktion Erste Firma ${eindeutig}`,
    ...KUNDENDATEN,
    admin: { name: "Erster Admin", email: wiederverwendeteEmail },
  });
  assert.equal(erste.status, 201);
  const ersteFirma = await erste.json();
  angelegteFirmen.push(ersteFirma.id);

  const zweiteName = `Transaktion Zweite Firma ${eindeutig}`;
  const zweite = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: zweiteName,
    ...KUNDENDATEN,
    module: ["beispiel"],
    admin: { name: "Zweiter Admin (Kollision)", email: wiederverwendeteEmail },
  });
  assert.equal(zweite.status, 400);

  const { rows } = await pool.query("SELECT 1 FROM firmen WHERE name = $1", [zweiteName]);
  assert.equal(rows.length, 0, "Bei einem Fehlschlag darf die Firma selbst nicht entstanden sein");
});

test("Bearbeiten ohne Kundendaten im Formular (nur Sperren/Entsperren) lässt die Pflichtfelder in Ruhe", async () => {
  const eindeutig = crypto.randomUUID();
  const anlegen = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Nur-Sperren-Firma ${eindeutig}`,
    ...KUNDENDATEN,
  });
  const firma = await anlegen.json();
  angelegteFirmen.push(firma.id);

  const sperren = await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firma.id}`, { aktiv: false });
  assert.equal(sperren.status, 200);

  const bearbeitenOhneStrasse = await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firma.id}`, {
    strasse: "",
  });
  assert.equal(bearbeitenOhneStrasse.status, 400);
  assert.match((await bearbeitenOhneStrasse.json()).error, /Straße/);
});
