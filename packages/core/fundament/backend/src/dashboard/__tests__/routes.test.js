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
const emailUserA = `user-a-${crypto.randomUUID()}@example.test`;
const emailAdminB = `admin-b-${crypto.randomUUID()}@example.test`;

await erstelleBenutzer(firmaA, emailAdminA, "Admin");
await erstelleBenutzer(firmaA, emailUserA, "User");
await erstelleBenutzer(firmaB, emailAdminB, "Admin");

const emailSuperadmin = `superadmin-${crypto.randomUUID()}@example.test`;
await erstelleTestSuperadmin(emailSuperadmin, await hashPassword(PASSWORT));

after(async () => {
  server.close();
  await loescheTestfirma(firmaA);
  await loescheTestfirma(firmaB);
  await loescheTestSuperadmin(emailSuperadmin);
  await schliesseTestVerbindungen();
  await pool.end();
});

const { cookie: cookieAdminA } = await login(emailAdminA);
const { cookie: cookieUserA } = await login(emailUserA);
const { cookie: cookieAdminB } = await login(emailAdminB);
const { cookie: cookieSuperadmin } = await login(emailSuperadmin, PASSWORT);

test("Ohne Anmeldung gibt es 401", async () => {
  assert.equal((await api(null, "GET", "/api/dashboard/layout")).status, 401);
  assert.equal((await api(null, "GET", "/api/dashboard/daten")).status, 401);
});

test("Rechte: Admin sieht 'Letzte Aktivitäten', User nicht", async () => {
  const layoutAdmin = await (await api(cookieAdminA, "GET", "/api/dashboard/layout")).json();
  assert.ok(layoutAdmin.some((k) => k.key === "letzteAktivitaeten"));

  const layoutUser = await (await api(cookieUserA, "GET", "/api/dashboard/layout")).json();
  assert.ok(!layoutUser.some((k) => k.key === "letzteAktivitaeten"));

  const datenUser = await (await api(cookieUserA, "GET", "/api/dashboard/daten")).json();
  assert.equal(datenUser.letzteAktivitaeten, undefined);
});

test("Mandanten-Trennung: Kontaktzahlen einer Firma wirken nicht auf eine andere", async () => {
  await api(cookieAdminA, "POST", "/api/kontakte", { nachname: "Dashboard-Test-Kontakt" });

  const datenA = await (await api(cookieAdminA, "GET", "/api/dashboard/daten")).json();
  const datenB = await (await api(cookieAdminB, "GET", "/api/dashboard/daten")).json();
  assert.ok(datenA.kontakteGesamt >= 1);
  assert.equal(datenB.kontakteGesamt, 0);
});

test("Anpassung bleibt nach erneutem Login erhalten", async () => {
  const vorher = await (await api(cookieUserA, "GET", "/api/dashboard/layout")).json();
  const neu = vorher.map((k) => ({ ...k, sichtbar: k.key !== "neueKontakte" }));
  // Reihenfolge umdrehen, damit die Sortierung sicher mitgespeichert wird.
  neu.reverse();

  const gespeichert = await (await api(cookieUserA, "PUT", "/api/dashboard/layout", { layout: neu })).json();
  assert.deepEqual(gespeichert.map((k) => k.key), neu.map((k) => k.key));
  assert.equal(gespeichert.find((k) => k.key === "neueKontakte").sichtbar, false);

  // Neu einloggen (neue Sitzung) -- Layout muss trotzdem noch da sein.
  const { cookie: cookieErneut } = await login(emailUserA);
  const nachLogin = await (await api(cookieErneut, "GET", "/api/dashboard/layout")).json();
  assert.deepEqual(nachLogin.map((k) => k.key), neu.map((k) => k.key));
  assert.equal(nachLogin.find((k) => k.key === "neueKontakte").sichtbar, false);
});

test("Firmen-Standard greift bei einem neuen Benutzer", async () => {
  const eigenes = await (await api(cookieAdminA, "GET", "/api/dashboard/layout")).json();
  const umsortiert = [...eigenes].reverse();
  await api(cookieAdminA, "PUT", "/api/dashboard/layout", { layout: umsortiert });

  const standardSetzen = await api(cookieAdminA, "POST", "/api/dashboard/layout/standard");
  assert.equal(standardSetzen.status, 200);

  const emailNeu = `neu-${crypto.randomUUID()}@example.test`;
  await erstelleBenutzer(firmaA, emailNeu, "User");
  const { cookie: cookieNeu } = await login(emailNeu);

  const layoutNeu = await (await api(cookieNeu, "GET", "/api/dashboard/layout")).json();
  // Der neue User hat "Letzte Aktivitäten" nicht (Admin-only) -- Vergleich
  // nur über die Reihenfolge der für User sichtbaren Kacheln.
  const erwarteteReihenfolge = umsortiert
    .map((k) => k.key)
    .filter((key) => key !== "letzteAktivitaeten");
  assert.deepEqual(layoutNeu.map((k) => k.key), erwarteteReihenfolge);
});

test("User darf das Layout nicht als Firmen-Standard festlegen", async () => {
  const res = await api(cookieUserA, "POST", "/api/dashboard/layout/standard");
  assert.equal(res.status, 403);
});

test("Ausgeschalteter Baustein: seine Kachel verschwindet, Position bleibt beim Wiedereinschalten erhalten", async () => {
  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaA}/module/beispiel`, {
    aktiv: true,
  });

  const mitBaustein = await (await api(cookieAdminA, "GET", "/api/dashboard/layout")).json();
  assert.ok(mitBaustein.some((k) => k.key === "beispiel:beispiel"));

  // Kachel ganz nach vorne schieben und speichern, damit die Position
  // nachher wirklich geprüft werden kann (nicht einfach "am Ende").
  const nachVorne = [
    mitBaustein.find((k) => k.key === "beispiel:beispiel"),
    ...mitBaustein.filter((k) => k.key !== "beispiel:beispiel"),
  ];
  await api(cookieAdminA, "PUT", "/api/dashboard/layout", { layout: nachVorne });

  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaA}/module/beispiel`, {
    aktiv: false,
  });
  const ohneBaustein = await (await api(cookieAdminA, "GET", "/api/dashboard/layout")).json();
  assert.ok(!ohneBaustein.some((k) => k.key === "beispiel:beispiel"));

  await api(cookieSuperadmin, "PATCH", `/api/superadmin/firmen/${firmaA}/module/beispiel`, {
    aktiv: true,
  });
  const wiederDa = await (await api(cookieAdminA, "GET", "/api/dashboard/layout")).json();
  assert.equal(wiederDa[0].key, "beispiel:beispiel");
});
