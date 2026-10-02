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
const firma = await erstelleTestfirmaMitRechten("Rechte-Routen Test");

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
const emailUser = `user-${firma}@example.test`;
await erstelleBenutzer(emailAdmin, "Admin");
await erstelleBenutzer(emailUser, "User");

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestfirma(firma);
  await schliesseTestVerbindungen();
  await pool.end();
});

async function login(email) {
  const res = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwort: PASSWORT }),
  });
  const cookie = res.headers.get("set-cookie");
  const daten = await res.json();
  return { cookie, daten };
}

test("Login liefert die eigenen Rechte mit", async () => {
  const { daten } = await login(emailUser);
  assert.equal(daten.rechte.kontakte.sehen, true);
  assert.equal(daten.rechte.kontakte.loeschen, false);
});

test("Admin darf die Rechte-Matrix sehen ('Wer sieht was')", async () => {
  const { cookie } = await login(emailAdmin);
  const res = await fetch(`${basis}/api/rechte`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.ok(rows.length > 0);
  assert.ok(rows.some((r) => r.rolle === "User" && r.bereich === "kontakte"));
});

test("User darf die Rechte-Matrix nicht sehen", async () => {
  const { cookie } = await login(emailUser);
  const res = await fetch(`${basis}/api/rechte`, { headers: { cookie } });
  assert.equal(res.status, 403);
});

test("Ohne Anmeldung gibt es 401, nicht die Rechte-Matrix", async () => {
  const res = await fetch(`${basis}/api/rechte`);
  assert.equal(res.status, 401);
});
