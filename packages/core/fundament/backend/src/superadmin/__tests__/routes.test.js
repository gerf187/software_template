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
  erstelleTestSuperadmin,
  loescheTestSuperadmin,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

const PASSWORT = "Ein-Sicheres-Passwort-12";
const firma = await erstelleTestfirmaMitRechten("Superadmin-Routen Test");

async function erstelleBenutzer(email, rolle) {
  const hash = await hashPassword(PASSWORT);
  await withFirma(firma, (client) =>
    client.query(
      "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, $4, $4)",
      [firma, email, hash, rolle]
    )
  );
}

const emailAdmin = `admin-${firma}@example.test`;
await erstelleBenutzer(emailAdmin, "Admin");

const emailSuperadmin = `superadmin-${crypto.randomUUID()}@example.test`;
const superadminHash = await hashPassword("Ein-Sicheres-Passwort-12");
await erstelleTestSuperadmin(emailSuperadmin, superadminHash);

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

const angelegteFirmen = [];

after(async () => {
  server.close();
  for (const id of angelegteFirmen) {
    await loescheTestfirma(id);
  }
  await loescheTestfirma(firma);
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
const { cookie: cookieAdmin } = await login(emailAdmin, PASSWORT);

test("Normaler Benutzer darf keine Firmen verwalten", async () => {
  const res = await api(cookieAdmin, "GET", "/api/superadmin/firmen");
  assert.equal(res.status, 403);
});

test("Superadmin kann eine Firma anlegen, sperren und entsperren", async () => {
  const eindeutig = crypto.randomUUID();
  const anlegen = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Test-Firma ${eindeutig}`,
    slug: `test-firma-${eindeutig}`,
  });
  assert.equal(anlegen.status, 201);
  const neueFirma = await anlegen.json();
  angelegteFirmen.push(neueFirma.id);
  assert.equal(neueFirma.aktiv, true);

  const sperren = await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${neueFirma.id}`, {
    aktiv: false,
  });
  assert.equal((await sperren.json()).aktiv, false);

  const entsperren = await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${neueFirma.id}`, {
    aktiv: true,
  });
  assert.equal((await entsperren.json()).aktiv, true);
});

test("Superadmin kann Name und Kürzel einer Firma ändern, ohne den Status zu verlieren", async () => {
  const eindeutig = crypto.randomUUID();
  const anlegen = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Alter Name ${eindeutig}`,
    slug: `alter-slug-${eindeutig}`,
  });
  const neueFirma = await anlegen.json();
  angelegteFirmen.push(neueFirma.id);

  const bearbeiten = await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${neueFirma.id}`, {
    name: `Neuer Name ${eindeutig}`,
    slug: `neuer-slug-${eindeutig}`,
  });
  assert.equal(bearbeiten.status, 200);
  const aktualisiert = await bearbeiten.json();
  assert.equal(aktualisiert.name, `Neuer Name ${eindeutig}`);
  assert.equal(aktualisiert.slug, `neuer-slug-${eindeutig}`);
  assert.equal(aktualisiert.aktiv, true);

  const nurSperren = await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${neueFirma.id}`, {
    aktiv: false,
  });
  const nachSperren = await nurSperren.json();
  assert.equal(nachSperren.name, `Neuer Name ${eindeutig}`);
  assert.equal(nachSperren.aktiv, false);
});

test("Einladung legt einen Admin mit Startpasswort an, das beim ersten Login geändert werden muss", async () => {
  const eindeutig = crypto.randomUUID();
  const anlegen = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Einladungs-Firma ${eindeutig}`,
    slug: `einladung-${eindeutig}`,
  });
  const neueFirma = await anlegen.json();
  angelegteFirmen.push(neueFirma.id);

  const email = `eingeladen-${eindeutig}@example.test`;
  const einladen = await api(cookieSuperadmin, "POST", `/api/superadmin/firmen/${neueFirma.id}/einladen`, {
    email,
    name: "Neuer Admin",
  });
  assert.equal(einladen.status, 201);
  const { startpasswort } = await einladen.json();
  assert.ok(startpasswort.length >= 12);

  const { daten: loginDaten, cookie: cookieNeu } = await login(email, startpasswort);
  assert.equal(loginDaten.mussPasswortAendern, true);

  const falschesAltes = await api(cookieNeu, "POST", "/api/auth/passwort-aendern", {
    aktuellesPasswort: "falsches-passwort",
    neuesPasswort: "Ein-Ganz-Neues-Kennwort-9",
  });
  assert.equal(falschesAltes.status, 401);

  const aendern = await api(cookieNeu, "POST", "/api/auth/passwort-aendern", {
    aktuellesPasswort: startpasswort,
    neuesPasswort: "Ein-Ganz-Neues-Kennwort-9",
  });
  assert.equal(aendern.status, 200);

  const me = await api(cookieNeu, "GET", "/api/auth/me");
  assert.equal((await me.json()).mussPasswortAendern, false);
});

test("Eine gesperrte Firma kann sich nicht mehr anmelden", async () => {
  const eindeutig = crypto.randomUUID();
  const anlegen = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name: `Sperr-Firma ${eindeutig}`,
    slug: `sperr-firma-${eindeutig}`,
  });
  const neueFirma = await anlegen.json();
  angelegteFirmen.push(neueFirma.id);

  const email = `gesperrt-${eindeutig}@example.test`;
  const einladen = await api(cookieSuperadmin, "POST", `/api/superadmin/firmen/${neueFirma.id}/einladen`, {
    email,
    name: "Admin in gesperrter Firma",
  });
  const { startpasswort } = await einladen.json();

  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${neueFirma.id}`, { aktiv: false });

  const { res } = await login(email, startpasswort);
  assert.equal(res.status, 401);
});

test("Baustein 'beispiel' ist ohne Freischaltung per API nicht erreichbar (404)", async () => {
  const res = await api(cookieAdmin, "GET", "/api/module/beispiel");
  assert.equal(res.status, 404);
});

test("Nach dem Freischalten ist der Baustein erreichbar, nach dem Ausschalten wieder nicht", async () => {
  const freischalten = await api(
    cookieSuperadmin,
    "PATCH",
    `/api/superadmin/firmen/${firma}/module/beispiel`,
    { aktiv: true }
  );
  assert.equal(freischalten.status, 200);

  const erreichbar = await api(cookieAdmin, "GET", "/api/module/beispiel");
  assert.equal(erreichbar.status, 200);
  assert.equal((await erreichbar.json()).nachricht, "Hallo Baustein!");

  const liste = await api(cookieSuperadmin, "GET", `/api/superadmin/firmen/${firma}/module`);
  const listeDaten = await liste.json();
  assert.ok(listeDaten.find((m) => m.name === "beispiel" && m.aktiv === true));

  const ausschalten = await api(
    cookieSuperadmin,
    "PATCH",
    `/api/superadmin/firmen/${firma}/module/beispiel`,
    { aktiv: false }
  );
  assert.equal(ausschalten.status, 200);

  const nichtMehrErreichbar = await api(cookieAdmin, "GET", "/api/module/beispiel");
  assert.equal(nichtMehrErreichbar.status, 404);
});

test("Abhängigkeit verhindert Einschalten", async () => {
  const res = await api(
    cookieSuperadmin,
    "PATCH",
    `/api/superadmin/firmen/${firma}/module/beispiel-zwei`,
    { aktiv: true }
  );
  assert.equal(res.status, 400);
  const daten = await res.json();
  assert.match(daten.error, /beispiel/);

  // Erst "beispiel" einschalten, dann klappt auch die Abhängigkeit.
  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firma}/module/beispiel`, {
    aktiv: true,
  });
  const danach = await api(
    cookieSuperadmin,
    "PATCH",
    `/api/superadmin/firmen/${firma}/module/beispiel-zwei`,
    { aktiv: true }
  );
  assert.equal(danach.status, 200);
});

test("Superadmin sieht weiterhin keine Fachdaten", async () => {
  const res = await api(cookieSuperadmin, "GET", "/api/kontakte");
  assert.equal(res.status, 403);
});
