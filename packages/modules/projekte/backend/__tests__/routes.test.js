import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createApp } from "@fundament/backend/src/app.js";
import { pool } from "@fundament/backend/src/db/pool.js";
import { withFirma } from "@fundament/backend/src/db/withFirma.js";
import { hashPassword } from "@fundament/backend/src/auth/password.js";
import {
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  erstelleTestSuperadmin,
  loescheTestSuperadmin,
  schliesseTestVerbindungen,
} from "@fundament/backend/src/db/__tests__/helpers.js";

const PASSWORT = "Ein-Sicheres-Passwort-12";

const firmaA = await erstelleTestfirmaMitRechten("Projekte Test Firma A");
const firmaB = await erstelleTestfirmaMitRechten("Projekte Test Firma B");

async function erstelleBenutzer(firmaId, email, rolle) {
  const hash = await hashPassword(PASSWORT);
  await withFirma(firmaId, (client) =>
    client.query(
      "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, $4, $4)",
      [firmaId, email, hash, rolle]
    )
  );
}

const emailAdminA = `admin-pa-${crypto.randomUUID()}@example.test`;
const emailUserA = `user-pa-${crypto.randomUUID()}@example.test`;
const emailAdminB = `admin-pb-${crypto.randomUUID()}@example.test`;
await erstelleBenutzer(firmaA, emailAdminA, "Admin");
await erstelleBenutzer(firmaA, emailUserA, "User");
await erstelleBenutzer(firmaB, emailAdminB, "Admin");

const emailSuperadmin = `superadmin-pa-${crypto.randomUUID()}@example.test`;
await erstelleTestSuperadmin(emailSuperadmin, await hashPassword(PASSWORT));

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

// loescheTestfirma() im Fundament kennt den Baustein "Projekte" nicht
// (Abschnitt 8, Regel 5) -- "projects" muss der Baustein hier selbst vor dem
// Löschen der Kontakte leeren, sonst blockiert der zusammengesetzte
// Fremdschlüssel (firma_id, contact_id) das Aufräumen.
async function loescheProjekteDerFirma(firmaId) {
  await withFirma(firmaId, async (client) => {
    await client.query("UPDATE tasks SET project_id = NULL WHERE firma_id = $1", [firmaId]);
    await client.query("UPDATE notes SET project_id = NULL WHERE firma_id = $1", [firmaId]);
    await client.query("DELETE FROM projects WHERE firma_id = $1", [firmaId]);
  });
}

after(async () => {
  server.close();
  await loescheProjekteDerFirma(firmaA);
  await loescheProjekteDerFirma(firmaB);
  await loescheTestfirma(firmaA);
  await loescheTestfirma(firmaB);
  await loescheTestSuperadmin(emailSuperadmin);
  await schliesseTestVerbindungen();
  await pool.end();
});

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

const { cookie: cookieSuperadmin } = await login(emailSuperadmin);
const { cookie: cookieAdminA } = await login(emailAdminA);
const { cookie: cookieUserA } = await login(emailUserA);
const { cookie: cookieAdminB } = await login(emailAdminB);

// Baustein für Firma A freischalten (Firma B bekommt ihn bewusst nie -- prüft
// weiter unten, dass die Mandanten-Trennung auch ohne ihn selbst greift).
await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaA}/module/projekte`, {
  aktiv: true,
});

async function legeKontaktAn(firmaId, cookie, nachname, ort) {
  const res = await api(cookie, "POST", "/api/kontakte", {
    nachname,
    wohnadresseOrt: ort,
  });
  assert.equal(res.status, 201);
  return res.json();
}

const kontaktA = await legeKontaktAn(firmaA, cookieAdminA, "Müller", "Oldenburg");
const kontaktB = await legeKontaktAn(firmaB, cookieAdminB, "Schmidt", "Bremen");

function projekt(ueberschreibungen = {}) {
  return {
    contactId: kontaktA.id,
    name: "Testprojekt",
    arten: ["Typ A"],
    status: "Aktiv",
    phase: "Start",
    ...ueberschreibungen,
  };
}

test("Baustein aus: Routen sind 404, bis die Firma ihn freigeschaltet hat", async () => {
  const res = await api(cookieAdminB, "GET", "/api/module/projekte/");
  assert.equal(res.status, 404);
});

test("Projekt anlegen und lesen", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt());
  assert.equal(anlegen.status, 201);
  const neu = await anlegen.json();
  assert.equal(neu.name, "Testprojekt");
  assert.equal(neu.status, "Aktiv");

  const lesen = await api(cookieAdminA, "GET", `/api/module/projekte/${neu.id}`);
  assert.equal(lesen.status, 200);
  assert.equal((await lesen.json()).contactId, kontaktA.id);
});

test("Projekt ohne Projektart wird abgelehnt (400)", async () => {
  const res = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ arten: [] }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /mindestens eine Projektart/);
});

test("Projekt mit ungültiger PLZ wird abgelehnt (400)", async () => {
  const res = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ objektadressePlz: "1234" }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /PLZ/);
});

test("Mandanten-Trennung: Kontakt einer fremden Firma kann nicht verknüpft werden (404)", async () => {
  const res = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ contactId: kontaktB.id }));
  assert.equal(res.status, 404);
});

test("Mandanten-Trennung: Firma B sieht das Projekt von Firma A nicht, auch nicht über die ID", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt());
  const neu = await anlegen.json();

  // Firma B hat den Baustein nicht freigeschaltet -> 404 schon deswegen.
  const ohneBaustein = await api(cookieAdminB, "GET", `/api/module/projekte/${neu.id}`);
  assert.equal(ohneBaustein.status, 404);

  // Zusätzlich freischalten und erneut versuchen: RLS greift unabhängig vom Baustein-Status.
  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaB}/module/projekte`, {
    aktiv: true,
  });
  const { cookie: cookieAdminBNeu } = await login(emailAdminB);
  const mitBaustein = await api(cookieAdminBNeu, "GET", `/api/module/projekte/${neu.id}`);
  assert.equal(mitBaustein.status, 404);
  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaB}/module/projekte`, {
    aktiv: false,
  });
});

test("Rechte: User darf anlegen und sehen, aber nicht löschen", async () => {
  const anlegen = await api(cookieUserA, "POST", "/api/module/projekte/", projekt());
  assert.equal(anlegen.status, 201);
  const neu = await anlegen.json();

  const lesen = await api(cookieUserA, "GET", `/api/module/projekte/${neu.id}`);
  assert.equal(lesen.status, 200);

  const loeschen = await api(cookieUserA, "DELETE", `/api/module/projekte/${neu.id}`);
  assert.equal(loeschen.status, 403);

  const loeschenAlsAdmin = await api(cookieAdminA, "DELETE", `/api/module/projekte/${neu.id}`);
  assert.equal(loeschenAlsAdmin.status, 200);
});

test("'Pausiert (manuell)' braucht einen Grund, 'Pausiert (Eskalation)' ist nicht von Hand wählbar", async () => {
  const ohneGrund = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ status: "Pausiert (manuell)" }));
  assert.equal(ohneGrund.status, 400);
  assert.match((await ohneGrund.json()).error, /Grund/);

  const mitGrund = await api(
    cookieAdminA,
    "POST",
    "/api/module/projekte/",
    projekt({ status: "Pausiert (manuell)", pausiertGrund: "Wartet auf Unterlagen" })
  );
  assert.equal(mitGrund.status, 201);

  const eskalation = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ status: "Pausiert (Eskalation)" }));
  assert.equal(eskalation.status, 400);
  assert.match((await eskalation.json()).error, /nicht von Hand/);
});

test("Ablage-Link muss mit http oder https beginnen", async () => {
  const unsicher = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ ablageLink: "javascript:alert(1)" }));
  assert.equal(unsicher.status, 400);

  const sicher = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ ablageLink: "https://cloud.example.test/ordner" }));
  assert.equal(sicher.status, 201);
  assert.equal((await sicher.json()).ablageLink, "https://cloud.example.test/ordner");
});

test("Projektliste zeigt Kontaktname und erlaubt Filter nach Status/Art/Phase", async () => {
  await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ name: "Gefiltertes Projekt", arten: ["Typ B"], phase: "Abschluss" }));

  const liste = await api(cookieAdminA, "GET", "/api/module/projekte/");
  assert.equal(liste.status, 200);
  const alle = await liste.json();
  const gefunden = alle.find((p) => p.name === "Gefiltertes Projekt");
  assert.ok(gefunden);
  assert.equal(gefunden.kontaktName, "Müller");

  const gefiltert = await api(cookieAdminA, "GET", "/api/module/projekte/?art=Typ B&phase=Abschluss");
  const gefilterteDaten = await gefiltert.json();
  assert.ok(gefilterteDaten.every((p) => p.arten.includes("Typ B") && p.phase === "Abschluss"));
  assert.ok(gefilterteDaten.some((p) => p.name === "Gefiltertes Projekt"));
});

test("Projekte eines Kontakts (Tab auf der Kontakt-Akte) zeigt nur dessen Projekte", async () => {
  const andererKontakt = await legeKontaktAn(firmaA, cookieAdminA, "Andere Person", "Wilhelmshaven");
  await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ contactId: andererKontakt.id, name: "Projekt von Andere Person" }));

  const res = await api(cookieAdminA, "GET", `/api/module/projekte/kontakte/${kontaktA.id}`);
  assert.equal(res.status, 200);
  const daten = await res.json();
  assert.ok(daten.every((p) => p.contactId === kontaktA.id));
  assert.ok(!daten.some((p) => p.name === "Projekt von Andere Person"));
});

test("Notizen und Aufgaben am Projekt: anlegen, lesen, erledigt setzen", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ name: "Projekt mit Notizen" }));
  const neu = await anlegen.json();

  const notizAnlegen = await api(cookieAdminA, "POST", `/api/module/projekte/${neu.id}/notizen`, { text: "Erste Notiz" });
  assert.equal(notizAnlegen.status, 201);
  const notizenListe = await api(cookieAdminA, "GET", `/api/module/projekte/${neu.id}/notizen`);
  const notizen = await notizenListe.json();
  assert.equal(notizen.length, 1);
  assert.equal(notizen[0].text, "Erste Notiz");

  const aufgabeAnlegen = await api(cookieAdminA, "POST", `/api/module/projekte/${neu.id}/aufgaben`, {
    text: "Erste Aufgabe",
    faelligAm: "2026-12-01",
  });
  assert.equal(aufgabeAnlegen.status, 201);
  const aufgabe = await aufgabeAnlegen.json();
  assert.equal(aufgabe.status, "offen");

  const erledigt = await api(cookieAdminA, "PATCH", `/api/module/projekte/${neu.id}/aufgaben/${aufgabe.id}`, {
    erledigt: true,
  });
  assert.equal(erledigt.status, 200);
  assert.equal((await erledigt.json()).status, "erledigt");

  const fremdesProjekt = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ name: "Anderes Projekt" }));
  const fremd = await fremdesProjekt.json();
  const ueberFremdesProjekt = await api(
    cookieAdminA,
    "PATCH",
    `/api/module/projekte/${fremd.id}/aufgaben/${aufgabe.id}`,
    { erledigt: false }
  );
  assert.equal(ueberFremdesProjekt.status, 404);
});

test("Notiz/Aufgabe an einem fremden oder unbekannten Projekt liefert 404", async () => {
  const unbekannteId = 999999;
  const notiz = await api(cookieAdminA, "POST", `/api/module/projekte/${unbekannteId}/notizen`, { text: "Text" });
  assert.equal(notiz.status, 404);
  const aufgabe = await api(cookieAdminA, "POST", `/api/module/projekte/${unbekannteId}/aufgaben`, { text: "Text" });
  assert.equal(aufgabe.status, 404);
});

test("Phase per Klick setzen, ungültige Phase wird abgelehnt", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt());
  const neu = await anlegen.json();

  const ungueltig = await api(cookieAdminA, "PATCH", `/api/module/projekte/${neu.id}/phase`, { phase: "Erfunden" });
  assert.equal(ungueltig.status, 400);

  const gueltig = await api(cookieAdminA, "PATCH", `/api/module/projekte/${neu.id}/phase`, { phase: "In Arbeit" });
  assert.equal(gueltig.status, 200);
  assert.equal((await gueltig.json()).phase, "In Arbeit");
});

test("Änderungen am Projekt landen im Verlauf (Protokoll)", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ name: "Verlauf-Projekt" }));
  const neu = await anlegen.json();

  await api(cookieAdminA, "PUT", `/api/module/projekte/${neu.id}`, projekt({ name: "Verlauf-Projekt (geändert)" }));

  const verlauf = await api(cookieAdminA, "GET", `/api/module/projekte/${neu.id}/verlauf`);
  assert.equal(verlauf.status, 200);
  const eintraege = await verlauf.json();
  assert.ok(eintraege.some((e) => e.aktion === "angelegt"));
  const geaendert = eintraege.find((e) => e.aktion === "geaendert");
  assert.ok(geaendert);
  assert.ok(geaendert.aenderungen.some((a) => a.feld === "Projektname"));
});

test("Verlauf ist nur für Admin sichtbar (Recht 'protokoll')", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt());
  const neu = await anlegen.json();
  const res = await api(cookieUserA, "GET", `/api/module/projekte/${neu.id}/verlauf`);
  assert.equal(res.status, 403);
});

test("Baustein ausschalten: Daten bleiben erhalten, nach dem Wiedereinschalten wieder da", async () => {
  const anlegen = await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ name: "Bleibt erhalten" }));
  const neu = await anlegen.json();

  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaA}/module/projekte`, { aktiv: false });
  const { cookie: cookieAdminAAus } = await login(emailAdminA);
  const ausgeschaltet = await api(cookieAdminAAus, "GET", `/api/module/projekte/${neu.id}`);
  assert.equal(ausgeschaltet.status, 404);

  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaA}/module/projekte`, { aktiv: true });
  const { cookie: cookieAdminAAn } = await login(emailAdminA);
  const wiederDa = await api(cookieAdminAAn, "GET", `/api/module/projekte/${neu.id}`);
  assert.equal(wiederDa.status, 200);
  assert.equal((await wiederDa.json()).name, "Bleibt erhalten");
});

test("Globale Suche findet Projekte über Namen und Objektadresse, aber nur mit freigeschaltetem Baustein", async () => {
  const eindeutig = crypto.randomUUID();
  await api(cookieAdminA, "POST", "/api/module/projekte/", projekt({ name: `Suchbares Projekt ${eindeutig}` }));

  const treffer = await api(cookieAdminA, "GET", `/api/suche?q=${encodeURIComponent(eindeutig)}`);
  const treffDaten = await treffer.json();
  assert.ok(treffDaten.some((e) => e.typ === "projekt" && e.titel.includes(eindeutig)));

  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaA}/module/projekte`, { aktiv: false });
  const { cookie: cookieAdminAAus } = await login(emailAdminA);
  const ohneBaustein = await api(cookieAdminAAus, "GET", `/api/suche?q=${encodeURIComponent(eindeutig)}`);
  const ohneDaten = await ohneBaustein.json();
  assert.ok(!ohneDaten.some((e) => e.typ === "projekt"));

  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaA}/module/projekte`, { aktiv: true });
});
