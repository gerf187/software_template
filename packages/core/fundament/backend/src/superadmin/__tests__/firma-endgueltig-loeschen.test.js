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

// Pflicht-Kundendaten (Teil B) für POST /firmen -- für diese Tests immer
// dieselben Werte, nur der Name unterscheidet die Firmen.
async function legeFirmaAn(name) {
  const res = await api(cookieSuperadmin, "POST", "/api/superadmin/firmen", {
    name,
    strasse: "Teststraße 1",
    plz: "12345",
    ort: "Teststadt",
    ansprechpartner: "Ansprechpartner Test",
    rechnungsEmail: "rechnung@example.test",
  });
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

  // Projekt (Baustein "Projekte") mit eigener Aufgabe und Notiz am Projekt --
  // das ist genau der Fall, an dem firma_endgueltig_loeschen() bisher scheiterte
  // (Fremdschlüssel projects -> contacts, "projects" wurde nicht gelöscht).
  const projektRows = await withFirma(zuLoeschen.id, (client) =>
    client
      .query(
        `INSERT INTO projects (firma_id, contact_id, name, status, phase)
         VALUES ($1, $2, 'Testprojekt', 'offen', 'Anfrage') RETURNING id`,
        [zuLoeschen.id, kontaktId]
      )
      .then((r) => r.rows)
  );
  const projektId = projektRows[0].id;
  await withFirma(zuLoeschen.id, (client) =>
    client.query(
      "INSERT INTO notes (firma_id, contact_id, project_id, text) VALUES ($1, $2, $3, 'Projekt-Notiz')",
      [zuLoeschen.id, kontaktId, projektId]
    )
  );
  await withFirma(zuLoeschen.id, (client) =>
    client.query(
      "INSERT INTO tasks (firma_id, contact_id, project_id, text) VALUES ($1, $2, $3, 'Projekt-Aufgabe')",
      [zuLoeschen.id, kontaktId, projektId]
    )
  );

  // Gleichnamiger Kontakt auch in der anderen Firma, damit der Trennungs-Test
  // wirklich prüft, dass deren Daten unberührt bleiben.
  await withFirma(andereFirma.id, (client) =>
    client.query("INSERT INTO contacts (firma_id, nachname) VALUES ($1, 'Andere Firma Kontakt')", [
      andereFirma.id,
    ])
  );

  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${zuLoeschen.id}`, { aktiv: false });

  // Wächter (Teil A, Punkt 3): alle Tabellen mit Spalte firma_id selbst
  // ermitteln, nicht fest eintragen -- ein künftiger Baustein, der beim
  // Löschen vergessen wird, fällt damit automatisch auf.
  const { rows: firmaTabellen } = await pool.query(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'firma_id'
       AND table_name NOT IN ('firmen', 'plattform_protokoll')
     ORDER BY table_name`
  );
  assert.ok(
    firmaTabellen.some((r) => r.table_name === "projects"),
    "Baustein 'Projekte' muss in der Tabellen-Liste auftauchen, sonst testet dieser Wächter nichts."
  );

  const res = await api(cookieSuperadmin, "DELETE", `/api/superadmin/firmen/${zuLoeschen.id}`, {
    nameBestaetigung: zuLoeschen.name,
  });
  assert.equal(res.status, 200);
  const { bereiche } = await res.json();
  assert.equal(bereiche.contacts, 1);
  assert.equal(bereiche.notes, 2);
  assert.equal(bereiche.tasks, 2);
  assert.equal(bereiche.projects, 1);
  assert.equal(bereiche.users, 1);
  assert.equal(bereiche.firma_module, 1);
  assert.ok(bereiche.aenderungsprotokoll >= 1);

  const firmaWeg = await pool.query("SELECT 1 FROM firmen WHERE id = $1", [zuLoeschen.id]);
  assert.equal(firmaWeg.rowCount, 0);

  // Wächter: in KEINER der gefundenen Tabellen darf noch eine Zeile dieser
  // Firma übrig sein.
  for (const { table_name } of firmaTabellen) {
    const uebrig = await pool.query(
      `SELECT 1 FROM ${table_name} WHERE firma_id = $1`,
      [zuLoeschen.id]
    );
    assert.equal(uebrig.rowCount, 0, `Tabelle "${table_name}" hat noch Zeilen der gelöschten Firma.`);
  }

  // Plattform-Protokoll (ohne Firmenbezug) hat einen Eintrag bekommen.
  const protokollEintrag = await pool.query(
    "SELECT firma_name, bereiche FROM plattform_protokoll WHERE firma_name = $1",
    [zuLoeschen.name]
  );
  assert.equal(protokollEintrag.rowCount, 1);
  assert.equal(protokollEintrag.rows[0].bereiche.contacts, 1);

  // Andere Firma: unberührt.
  const andereNochDa = await pool.query("SELECT 1 FROM firmen WHERE id = $1", [andereFirma.id]);
  assert.equal(andereNochDa.rowCount, 1);
  const andererKontaktNochDa = await withFirma(andereFirma.id, (client) =>
    client.query("SELECT 1 FROM contacts WHERE firma_id = $1", [andereFirma.id]).then((r) => r.rowCount)
  );
  assert.equal(andererKontaktNochDa, 1);
});

test("Firma mit echter Mitarbeiter-Änderung im Protokoll kann trotzdem endgültig gelöscht werden (Bugfix Teil A)", async () => {
  const eindeutig = crypto.randomUUID();
  const firma = await legeFirmaAn(`Protokoll-Löschen-Firma ${eindeutig}`);
  uebrigeFirmen.push(firma.id);

  // Echten Mitarbeiter anlegen und ECHT einloggen -- nur dann setzt die
  // Datenbank-Sitzung "app.current_user_id" (siehe withFirma), und der
  // Änderungsprotokoll-Trigger schreibt eine echte user_id statt NULL. Direkte
  // SQL-Einfügungen (wie im Test oben) decken genau diesen Fehler nicht auf.
  const einladen = await api(cookieSuperadmin, "POST", `/api/superadmin/firmen/${firma.id}/einladen`, {
    email: `mitarbeiter-protokoll-${eindeutig}@example.test`,
    name: "Mitarbeiter mit Protokoll-Eintrag",
  });
  assert.equal(einladen.status, 201);
  const { email: mitarbeiterEmail, startpasswort } = await einladen.json();

  const { cookie: cookieMitarbeiter } = await login(mitarbeiterEmail, startpasswort);

  // Startpasswort muss vor der ersten Aktion geändert werden (Abschnitt 8) --
  // sonst sperrt requireAuth jede geschützte Route.
  const passwortGeaendert = await api(cookieMitarbeiter, "POST", "/api/auth/passwort-aendern", {
    neuesPasswort: "Mitarbeiter-Geheim-2026",
  });
  assert.equal(passwortGeaendert.status, 200);

  const angelegt = await api(cookieMitarbeiter, "POST", "/api/kontakte", { nachname: "Vom Mitarbeiter angelegt" });
  assert.equal(angelegt.status, 201);

  // Die Protokollzeile von eben verweist per user_id auf genau den Mitarbeiter,
  // der gleich mitgelöscht wird -- das ist der Fall, an dem die Löschfunktion
  // bisher mit "violates foreign key constraint aenderungsprotokoll_user_firma_fkey"
  // abbrach (Migration 0020 löschte "aenderungsprotokoll" immer erst nach "users").
  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firma.id}`, { aktiv: false });

  const res = await api(cookieSuperadmin, "DELETE", `/api/superadmin/firmen/${firma.id}`, {
    nameBestaetigung: firma.name,
  });
  assert.equal(res.status, 200, JSON.stringify(await res.json().catch(() => null)));

  const firmaWeg = await pool.query("SELECT 1 FROM firmen WHERE id = $1", [firma.id]);
  assert.equal(firmaWeg.rowCount, 0);
});
