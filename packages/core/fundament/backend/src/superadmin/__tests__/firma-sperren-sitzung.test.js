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

// Eine gesperrte Firma darf bestehende Sitzungen nicht weiter nutzen
// (nicht erst beim nächsten Login).

const PASSWORT = "Ein-Sicheres-Passwort-12";
const SA_PASSWORT = "Superadmin-Sitzung-Passwort-9";
const firmaId = await erstelleTestfirmaMitRechten("Sperre Sitzung");
const emailAdmin = `admin-sperre-${crypto.randomUUID()}@example.test`;
const emailSuperadmin = `sa-sperre-${crypto.randomUUID()}@example.test`;

const adminHash = await hashPassword(PASSWORT);
await withFirma(firmaId, (client) =>
  client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Admin', 'Admin')",
    [firmaId, emailAdmin, adminHash]
  )
);
await erstelleTestSuperadmin(emailSuperadmin, await hashPassword(SA_PASSWORT));

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestSuperadmin(emailSuperadmin);
  await loescheTestfirma(firmaId);
  await schliesseTestVerbindungen();
  await pool.end();
});

async function login(email, passwort) {
  const res = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwort }),
  });
  return { status: res.status, cookie: res.headers.get("set-cookie") };
}

function api(cookie, method, path, body) {
  return fetch(`${basis}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

test("Gesperrte Firma: bestehende Sitzung wird sofort abgelehnt, nach Entsperren gilt ein neuer Login", async () => {
  const admin = await login(emailAdmin, PASSWORT);
  assert.equal(admin.status, 200);
  assert.equal((await api(admin.cookie, "GET", "/api/kontakte")).status, 200);

  const sa = await login(emailSuperadmin, SA_PASSWORT);
  assert.equal(sa.status, 200);

  const sperren = await api(sa.cookie, "PATCH", `/api/superadmin/firmen/${firmaId}`, { aktiv: false });
  assert.equal(sperren.status, 200);

  const nachSperre = await api(admin.cookie, "GET", "/api/kontakte");
  assert.equal(nachSperre.status, 401, "bestehende Sitzung muss nach dem Sperren wegfallen");

  const entsperren = await api(sa.cookie, "PATCH", `/api/superadmin/firmen/${firmaId}`, { aktiv: true });
  assert.equal(entsperren.status, 200);

  // Die alte Sitzung wurde beim Sperren gelöscht -- wer sich neu anmeldet, kommt rein.
  assert.equal((await api(admin.cookie, "GET", "/api/kontakte")).status, 401);
  const neu = await login(emailAdmin, PASSWORT);
  assert.equal(neu.status, 200);
  assert.equal((await api(neu.cookie, "GET", "/api/kontakte")).status, 200);
});
