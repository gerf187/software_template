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

// Prüft: Fehler in async-Routen legen den Server nicht lahm (Express 5 fängt
// sie ab, ungültige IDs liefern 404 statt 500, fremde Kontakte 404).

const PASSWORT = "Ein-Sicheres-Passwort-12";
const firmaA = await erstelleTestfirmaMitRechten("Fehler Test A");
const firmaB = await erstelleTestfirmaMitRechten("Fehler Test B");

const emailAdminA = `admin-a-${firmaA}@example.test`;
const hashA = await hashPassword(PASSWORT);
await withFirma(firmaA, (client) =>
  client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Admin A', 'Admin')",
    [firmaA, emailAdminA, hashA]
  )
);

// Ein Kontakt, der zu Firma B gehört -- Firma A darf ihn nicht sehen.
const fremderKontakt = await withFirma(firmaB, (client) =>
  client
    .query("INSERT INTO contacts (firma_id, nachname) VALUES ($1, 'Fremd') RETURNING id", [firmaB])
    .then((r) => r.rows[0].id)
);

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

async function serverLebt() {
  const res = await fetch(`${basis}/api/health`);
  return res.status === 200;
}

test("Ungültige ID in der URL liefert 404 und der Server läuft weiter", async () => {
  const cookie = await login(emailAdminA);
  const res = await api(cookie, "GET", "/api/kontakte/abc");
  assert.equal(res.status, 404);
  assert.equal(await serverLebt(), true);
});

test("Notiz an einen fremden Kontakt liefert 404 und der Server läuft weiter", async () => {
  const cookie = await login(emailAdminA);
  const res = await api(cookie, "POST", `/api/kontakte/${fremderKontakt}/notizen`, {
    text: "Versuch über fremde ID",
  });
  assert.equal(res.status, 404);
  assert.equal(await serverLebt(), true);
});

test("Fremde Kontakt-ID wird auch beim Lesen nicht gefunden (404)", async () => {
  const cookie = await login(emailAdminA);
  const res = await api(cookie, "GET", `/api/kontakte/${fremderKontakt}`);
  assert.equal(res.status, 404);
  assert.equal(await serverLebt(), true);
});

test("Aufgabe an einen fremden Kontakt liefert 404 und der Server läuft weiter", async () => {
  const cookie = await login(emailAdminA);
  const res = await api(cookie, "POST", `/api/kontakte/${fremderKontakt}/aufgaben`, {
    text: "Versuch über fremde ID",
  });
  assert.equal(res.status, 404);
  assert.equal(await serverLebt(), true);
});

test("Ungültige Aufgaben-ID in der URL liefert 404 und der Server läuft weiter", async () => {
  const cookie = await login(emailAdminA);
  const res = await api(cookie, "PATCH", `/api/kontakte/${fremderKontakt}/aufgaben/abc`, {
    erledigt: true,
  });
  assert.equal(res.status, 404);
  assert.equal(await serverLebt(), true);
});

test("Aufgabe einer fremden Firma wird über einen fremden Kontakt-Pfad nicht geändert (404)", async () => {
  const fremdeAufgabe = await withFirma(firmaB, (client) =>
    client
      .query(
        "INSERT INTO tasks (firma_id, contact_id, text, status) VALUES ($1, $2, 'Fremde Aufgabe', 'offen') RETURNING id",
        [firmaB, fremderKontakt]
      )
      .then((r) => r.rows[0].id)
  );

  const cookie = await login(emailAdminA);
  const res = await api(cookie, "PATCH", `/api/kontakte/${fremderKontakt}/aufgaben/${fremdeAufgabe}`, {
    erledigt: true,
  });
  assert.equal(res.status, 404);
  assert.equal(await serverLebt(), true);

  const status = await withFirma(firmaB, (client) =>
    client
      .query("SELECT status FROM tasks WHERE id = $1", [fremdeAufgabe])
      .then((r) => r.rows[0].status)
  );
  assert.equal(status, "offen", "fremde Aufgabe darf nicht verändert worden sein");
});
