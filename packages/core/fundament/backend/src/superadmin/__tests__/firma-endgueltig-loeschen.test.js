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

const emailSuperadmin = `superadmin-loeschen-${crypto.randomUUID()}@example.test`;
const superadminHash = await hashPassword(PASSWORT);
await erstelleTestSuperadmin(emailSuperadmin, superadminHash);

const emailAdmin = `admin-loeschen-${crypto.randomUUID()}@example.test`;
const firmaFuerAdmin = await erstelleTestfirmaMitRechten("Löschen-Test (Admin-Login)");
const adminHash = await hashPassword(PASSWORT);
await withFirma(firmaFuerAdmin, (client) =>
  client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Admin', 'Admin')",
    [firmaFuerAdmin, emailAdmin, adminHash]
  )
);

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;
const uebrigeFirmen = [firmaFuerAdmin];

after(async () => {
  server.close();
  for (const id of uebrigeFirmen) {
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

const { cookie: cookieSuperadmin } = await login(emailSuperadmin, PASSWORT);
const { cookie: cookieAdmin } = await login(emailAdmin, PASSWORT);

async function legeFirmaAn(name) {
  const res = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", { name });
  const daten = await res.json();
  return daten;
}

test("Normaler Benutzer darf eine Firma nicht endgültig löschen", async () => {
  const res = await api(cookieAdmin, "DELETE", `/api/superadmin/firmen/${firmaFuerAdmin}`, {
    nameBestaetigung: "egal",
  });
  assert.equal(res.status, 403);
});

test("Eine aktive Firma kann nicht endgültig gelöscht werden", async () => {
  const eindeutig = crypto.randomUUID();
  const firma = await legeFirmaAn(`Aktive Lösch-Firma ${eindeutig}`);
  uebrigeFirmen.push(firma.id);

  const res = await api(cookieSuperadmin, "DELETE", `/api/superadmin/firmen/${firma.id}`, {
    nameBestaetigung: firma.name,
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /aktiv/);

  const nochDa = await pool.query("SELECT 1 FROM firmen WHERE id = $1", [firma.id]);
  assert.equal(nochDa.rowCount, 1);
});

test("Falscher Firmenname wird abgelehnt, Firma bleibt bestehen", async () => {
  const eindeutig = crypto.randomUUID();
  const firma = await legeFirmaAn(`Falscher-Name-Firma ${eindeutig}`);
  uebrigeFirmen.push(firma.id);
  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firma.id}`, { aktiv: false });

  const res = await api(cookieSuperadmin, "DELETE", `/api/superadmin/firmen/${firma.id}`, {
    nameBestaetigung: "ganz falscher name",
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /[Nn]ame/);

  const nochDa = await pool.query("SELECT 1 FROM firmen WHERE id = $1", [firma.id]);
  assert.equal(nochDa.rowCount, 1);
});

test("Gesperrte Firma mit exaktem Namen wird komplett gelöscht, andere Firma bleibt unberührt", async () => {
  const eindeutig = crypto.randomUUID();
  const zuLoeschen = await legeFirmaAn(`Zu-Löschen-Firma ${eindeutig}`);
  const andereFirma = await legeFirmaAn(`Unberührte-Firma ${eindeutig}`);
  uebrigeFirmen.push(andereFirma.id);

  // Daten in der zu löschenden Firma anlegen: Mitarbeiter, Kontakt, Notiz, Aufgabe.
  const einladen = await api(cookieSuperadmin, "POST", `/api/superadmin/firmen/${zuLoeschen.id}/einladen`, {
    email: `mitarbeiter-${eindeutig}@example.test`,
    name: "Zu löschender Mitarbeiter",
  });
  assert.equal(einladen.status, 201);

  await withFirma(zuLoeschen.id, (client) =>
    client.query(
      `INSERT INTO contacts (firma_id, nachname) VALUES ($1, 'Testkontakt')`,
      [zuLoeschen.id]
    )
  );
  const kontaktRows = await withFirma(zuLoeschen.id, (client) =>
    client.query("SELECT id FROM contacts WHERE firma_id = $1", [zuLoeschen.id]).then((r) => r.rows)
  );
  const kontaktId = kontaktRows[0].id;
  await withFirma(zuLoeschen.id, (client) =>
    client.query("INSERT INTO notes (firma_id, contact_id, text) VALUES ($1, $2, 'Notiz')", [
      zuLoeschen.id,
      kontaktId,
    ])
  );
  await withFirma(zuLoeschen.id, (client) =>
    client.query("INSERT INTO tasks (firma_id, contact_id, text) VALUES ($1, $2, 'Aufgabe')", [
      zuLoeschen.id,
      kontaktId,
    ])
  );
  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${zuLoeschen.id}/module/beispiel`, {
    aktiv: true,
  });

  // Gleichnamiger Kontakt auch in der anderen Firma, damit der Trennungs-Test
  // wirklich prüft, dass deren Daten unberührt bleiben.
  await withFirma(andereFirma.id, (client) =>
    client.query("INSERT INTO contacts (firma_id, nachname) VALUES ($1, 'Andere Firma Kontakt')", [
      andereFirma.id,
    ])
  );

  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${zuLoeschen.id}`, { aktiv: false });

  const res = await api(cookieSuperadmin, "DELETE", `/api/superadmin/firmen/${zuLoeschen.id}`, {
    nameBestaetigung: zuLoeschen.name,
  });
  assert.equal(res.status, 200);
  const { bereiche } = await res.json();
  assert.equal(bereiche.kontakte, 1);
  assert.equal(bereiche.notizen, 1);
  assert.equal(bereiche.aufgaben, 1);
  assert.equal(bereiche.mitarbeiter, 1);
  assert.equal(bereiche.bausteine, 1);
  assert.ok(bereiche.aenderungsprotokoll >= 1);

  const firmaWeg = await pool.query("SELECT 1 FROM firmen WHERE id = $1", [zuLoeschen.id]);
  assert.equal(firmaWeg.rowCount, 0);
  const keineKontakte = await pool.query(
    "SELECT 1 FROM contacts WHERE firma_id = $1",
    [zuLoeschen.id]
  );
  assert.equal(keineKontakte.rowCount, 0);
  const keinProtokoll = await pool.query(
    "SELECT 1 FROM aenderungsprotokoll WHERE firma_id = $1",
    [zuLoeschen.id]
  );
  assert.equal(keinProtokoll.rowCount, 0);

  // Plattform-Protokoll (ohne Firmenbezug) hat einen Eintrag bekommen.
  const protokollEintrag = await pool.query(
    "SELECT firma_name, bereiche FROM plattform_protokoll WHERE firma_name = $1",
    [zuLoeschen.name]
  );
  assert.equal(protokollEintrag.rowCount, 1);
  assert.equal(protokollEintrag.rows[0].bereiche.kontakte, 1);

  // Andere Firma: unberührt.
  const andereNochDa = await pool.query("SELECT 1 FROM firmen WHERE id = $1", [andereFirma.id]);
  assert.equal(andereNochDa.rowCount, 1);
  const andererKontaktNochDa = await withFirma(andereFirma.id, (client) =>
    client.query("SELECT 1 FROM contacts WHERE firma_id = $1", [andereFirma.id]).then((r) => r.rowCount)
  );
  assert.equal(andererKontaktNochDa, 1);
});
