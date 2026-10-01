import { test, after } from "node:test";
import assert from "node:assert/strict";
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
const firmaA = await erstelleTestfirmaMitRechten("Kontakte Test A");
const firmaB = await erstelleTestfirmaMitRechten("Kontakte Test B");

async function erstelleBenutzer(firmaId, email, rolle) {
  const hash = await hashPassword(PASSWORT);
  await withFirma(firmaId, (client) =>
    client.query(
      "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, $4, $4)",
      [firmaId, email, hash, rolle]
    )
  );
}

const emailAdminA = `admin-a-${firmaA}@example.test`;
const emailMitarbeiterA = `mitarbeiter-a-${firmaA}@example.test`;
const emailBetrachterA = `betrachter-a-${firmaA}@example.test`;
const emailAdminB = `admin-b-${firmaB}@example.test`;
await erstelleBenutzer(firmaA, emailAdminA, "Admin");
await erstelleBenutzer(firmaA, emailMitarbeiterA, "Mitarbeiter");
await erstelleBenutzer(firmaA, emailBetrachterA, "Betrachter");
await erstelleBenutzer(firmaB, emailAdminB, "Admin");

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestfirma(firmaA);
  await loescheTestfirma(firmaB);
  await schliesseTestVerbindungen();
  await pool.end();
});

async function login(email) {
  const res = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwort: PASSWORT }),
  });
  return res.headers.get("set-cookie");
}

function api(cookie, method, path, body) {
  return fetch(`${basis}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const cookieAdminA = await login(emailAdminA);
const cookieMitarbeiterA = await login(emailMitarbeiterA);
const cookieBetrachterA = await login(emailBetrachterA);
const cookieAdminB = await login(emailAdminB);

test("Admin kann einen Kontakt anlegen", async () => {
  const res = await api(cookieAdminA, "POST", "/api/kontakte", {
    vorname: "Max",
    nachname: "Mustermann",
    email: "max@beispiel.test",
  });
  assert.equal(res.status, 201);
  const kontakt = await res.json();
  assert.equal(kontakt.nachname, "Mustermann");
});

test("Kontakt ohne Nachname wird abgelehnt", async () => {
  const res = await api(cookieAdminA, "POST", "/api/kontakte", { vorname: "Ohne Nachname" });
  assert.equal(res.status, 400);
});

test("Betrachter kann keinen Kontakt anlegen", async () => {
  const res = await api(cookieBetrachterA, "POST", "/api/kontakte", { nachname: "Verboten" });
  assert.equal(res.status, 403);
});

test("Betrachter kann Kontakte sehen", async () => {
  const res = await api(cookieBetrachterA, "GET", "/api/kontakte");
  assert.equal(res.status, 200);
});

test("Mitarbeiter kann einen Kontakt anlegen, aber nicht löschen", async () => {
  const anlegen = await api(cookieMitarbeiterA, "POST", "/api/kontakte", {
    nachname: "Mitarbeiter-Kontakt",
  });
  assert.equal(anlegen.status, 201);
  const kontakt = await anlegen.json();

  const loeschen = await api(cookieMitarbeiterA, "DELETE", `/api/kontakte/${kontakt.id}`);
  assert.equal(loeschen.status, 403);
});

test("Admin kann einen Kontakt löschen (Soft-Delete), er verschwindet aus Liste und Einzelabruf", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/kontakte", { nachname: "Wird gelöscht" });
  const kontakt = await anlegen.json();

  const loeschen = await api(cookieAdminA, "DELETE", `/api/kontakte/${kontakt.id}`);
  assert.equal(loeschen.status, 200);

  const einzeln = await api(cookieAdminA, "GET", `/api/kontakte/${kontakt.id}`);
  assert.equal(einzeln.status, 404);

  const liste = await api(cookieAdminA, "GET", "/api/kontakte");
  const rows = await liste.json();
  assert.ok(!rows.some((r) => r.id === kontakt.id));
});

test("Firma A sieht Kontakte von Firma B nicht, auch nicht per direkter ID", async () => {
  const anlegenB = await api(cookieAdminB, "POST", "/api/kontakte", { nachname: "Nur Firma B" });
  const kontaktB = await anlegenB.json();

  const listeA = await api(cookieAdminA, "GET", "/api/kontakte");
  const rowsA = await listeA.json();
  assert.ok(!rowsA.some((r) => r.id === kontaktB.id));

  const direktA = await api(cookieAdminA, "GET", `/api/kontakte/${kontaktB.id}`);
  assert.equal(direktA.status, 404);
});

test("Empfehlung auf einen Kontakt einer anderen Firma wird abgelehnt", async () => {
  const anlegenB = await api(cookieAdminB, "POST", "/api/kontakte", { nachname: "Fremder Kontakt" });
  const kontaktB = await anlegenB.json();

  const res = await api(cookieAdminA, "POST", "/api/kontakte", {
    nachname: "Verweist auf fremde Firma",
    empfohlenVonKontaktId: kontaktB.id,
  });
  assert.equal(res.status, 400);
});

test("Notizen und Aufgaben lassen sich anlegen, Aufgaben als erledigt markieren", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/kontakte", { nachname: "Mit Notizen" });
  const kontakt = await anlegen.json();

  const notiz = await api(cookieAdminA, "POST", `/api/kontakte/${kontakt.id}/notizen`, {
    text: "Testnotiz",
  });
  assert.equal(notiz.status, 201);

  const aufgabe = await api(cookieAdminA, "POST", `/api/kontakte/${kontakt.id}/aufgaben`, {
    text: "Testaufgabe",
    faelligAm: "2026-12-31",
  });
  assert.equal(aufgabe.status, 201);
  const aufgabeDaten = await aufgabe.json();
  assert.equal(aufgabeDaten.status, "offen");

  const erledigt = await api(
    cookieAdminA,
    "PATCH",
    `/api/kontakte/${kontakt.id}/aufgaben/${aufgabeDaten.id}`,
    { erledigt: true }
  );
  assert.equal(erledigt.status, 200);
  const erledigtDaten = await erledigt.json();
  assert.equal(erledigtDaten.status, "erledigt");
});

test("Export enthält nur die Daten dieses einen Kontakts", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/kontakte", { nachname: "Export Test" });
  const kontakt = await anlegen.json();
  await api(cookieAdminA, "POST", `/api/kontakte/${kontakt.id}/notizen`, { text: "Export-Notiz" });
  await api(cookieAdminA, "POST", `/api/kontakte/${kontakt.id}/aufgaben`, { text: "Export-Aufgabe" });

  const anderer = await api(cookieAdminA, "POST", "/api/kontakte", { nachname: "Anderer Kontakt" });
  const andererKontakt = await anderer.json();
  await api(cookieAdminA, "POST", `/api/kontakte/${andererKontakt.id}/notizen`, {
    text: "Gehört nicht zum Export",
  });

  const res = await api(cookieAdminA, "GET", `/api/kontakte/${kontakt.id}/export`);
  assert.equal(res.status, 200);
  const daten = await res.json();
  assert.equal(daten.kontakt.nachname, "Export Test");
  assert.equal(daten.notizen.length, 1);
  assert.equal(daten.notizen[0].text, "Export-Notiz");
  assert.equal(daten.aufgaben.length, 1);
});

test("Verlauf zeigt Protokoll-Einträge nur für diesen Kontakt", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/kontakte", { nachname: "Verlauf Test" });
  const kontakt = await anlegen.json();
  await api(cookieAdminA, "PUT", `/api/kontakte/${kontakt.id}`, { nachname: "Verlauf Test Geändert" });

  const res = await api(cookieAdminA, "GET", `/api/kontakte/${kontakt.id}/verlauf`);
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.equal(rows.length, 2);
  assert.ok(rows.some((r) => r.aktion === "angelegt"));
  assert.ok(rows.some((r) => r.aktion === "geaendert"));
});

test("Ohne Anmeldung gibt es 401", async () => {
  const res = await fetch(`${basis}/api/kontakte`);
  assert.equal(res.status, 401);
});
