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
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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

const firmaA = await erstelleTestfirmaMitRechten("Firma-Einstellungen Test A");
const firmaB = await erstelleTestfirmaMitRechten("Firma-Einstellungen Test B");

const emailAdminA = `admin-a-${crypto.randomUUID()}@example.test`;
const emailUserA = `user-a-${crypto.randomUUID()}@example.test`;
const emailAdminB = `admin-b-${crypto.randomUUID()}@example.test`;

await erstelleBenutzer(firmaA, emailAdminA, "Admin");
await erstelleBenutzer(firmaA, emailUserA, "User");
await erstelleBenutzer(firmaB, emailAdminB, "Admin");

after(async () => {
  server.close();
  await loescheTestfirma(firmaA);
  await loescheTestfirma(firmaB);
  await schliesseTestVerbindungen();
  await pool.end();
});

const { cookie: cookieAdminA } = await login(emailAdminA);
const { cookie: cookieUserA } = await login(emailUserA);
const { cookie: cookieAdminB } = await login(emailAdminB);

test("User sieht die Firmen-Einstellungen nicht", async () => {
  const res = await api(cookieUserA, "GET", "/api/firma/einstellungen");
  assert.equal(res.status, 403);
});

test("Admin kann Name, Logo und Akzentfarbe speichern", async () => {
  const res = await api(cookieAdminA, "PUT", "/api/firma/einstellungen", {
    name: "Esser Energieberatung",
    logo: PNG_1X1,
    akzentfarbe: "#1a2b3c",
  });
  assert.equal(res.status, 200);
  const daten = await res.json();
  assert.equal(daten.name, "Esser Energieberatung");
  assert.equal(daten.logo, PNG_1X1);
  assert.equal(daten.akzentfarbe, "#1a2b3c");

  const geladen = await (await api(cookieAdminA, "GET", "/api/firma/einstellungen")).json();
  assert.deepEqual(geladen, daten);
});

test("Ohne Firmennamen wird abgelehnt", async () => {
  const res = await api(cookieAdminA, "PUT", "/api/firma/einstellungen", {
    name: "   ",
    akzentfarbe: "#1a2b3c",
  });
  assert.equal(res.status, 400);
});

test("Ungültige Akzentfarbe wird abgelehnt", async () => {
  const res = await api(cookieAdminA, "PUT", "/api/firma/einstellungen", {
    name: "Firma A",
    akzentfarbe: "rot",
  });
  assert.equal(res.status, 400);
});

test("Logo mit falschem Dateityp wird abgelehnt", async () => {
  const res = await api(cookieAdminA, "PUT", "/api/firma/einstellungen", {
    name: "Firma A",
    logo: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  });
  assert.equal(res.status, 400);
});

test("Zu großes Logo wird abgelehnt", async () => {
  const res = await api(cookieAdminA, "PUT", "/api/firma/einstellungen", {
    name: "Firma A",
    logo: `data:image/png;base64,${"A".repeat(300_000)}`,
  });
  assert.equal(res.status, 400);
});

test("Logo kann wieder entfernt werden, ohne andere Einstellungen zu verlieren", async () => {
  const entfernt = await api(cookieAdminA, "PUT", "/api/firma/einstellungen", {
    name: "Esser Energieberatung",
    akzentfarbe: "#1a2b3c",
    logo: null,
  });
  assert.equal(entfernt.status, 200);
  const daten = await entfernt.json();
  assert.equal(daten.logo, null);
  assert.equal(daten.akzentfarbe, "#1a2b3c");
});

test("Mandanten-Trennung: Admin von Firma A ändert nie die Einstellungen von Firma B", async () => {
  await api(cookieAdminA, "PUT", "/api/firma/einstellungen", { name: "Übernommen" });

  const geladenB = await (await api(cookieAdminB, "GET", "/api/firma/einstellungen")).json();
  assert.notEqual(geladenB.name, "Übernommen");
});

test("/api/auth/me liefert die Firmen-Infos mit", async () => {
  const res = await api(cookieAdminA, "GET", "/api/auth/me");
  const daten = await res.json();
  assert.ok(daten.firma);
  assert.equal(daten.firma.akzentfarbe, "#1a2b3c");
});
