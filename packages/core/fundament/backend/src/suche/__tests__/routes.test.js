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

const firmaA = await erstelleTestfirmaMitRechten("Suche Test A");
const firmaB = await erstelleTestfirmaMitRechten("Suche Test B");

const emailAdminA = `admin-a-${crypto.randomUUID()}@example.test`;
const emailAdminB = `admin-b-${crypto.randomUUID()}@example.test`;
const eindeutig = crypto.randomUUID().slice(0, 8);

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

await api(cookieAdminA, "POST", "/api/kontakte", {
  vorname: "Erika",
  nachname: `Musterfrau-${eindeutig}`,
  organisation: "Muster GmbH",
});

test("Ohne Anmeldung gibt es 401", async () => {
  const res = await api(null, "GET", `/api/suche?q=${eindeutig}`);
  assert.equal(res.status, 401);
});

test("Zu kurze Suche liefert keine Treffer (keine teure Volltextsuche bei 1 Zeichen)", async () => {
  const res = await api(cookieAdminA, "GET", "/api/suche?q=a");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test("Findet einen Kontakt über Nachnamen", async () => {
  const res = await api(cookieAdminA, "GET", `/api/suche?q=${eindeutig}`);
  assert.equal(res.status, 200);
  const treffer = await res.json();
  assert.equal(treffer.length, 1);
  assert.equal(treffer[0].typ, "kontakt");
  assert.match(treffer[0].titel, new RegExp(eindeutig));
  assert.equal(treffer[0].to, `/kontakte/${treffer[0].id}`);
});

test("Mandanten-Trennung: Firma B findet den Kontakt von Firma A nicht", async () => {
  const res = await api(cookieAdminB, "GET", `/api/suche?q=${eindeutig}`);
  assert.deepEqual(await res.json(), []);
});
