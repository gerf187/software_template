import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { pool } from "../pool.js";
import { withFirma } from "../withFirma.js";
import { hashPassword } from "../../auth/password.js";
import {
  erstelleTestfirma,
  loescheTestfirma,
  erstelleTestSuperadmin,
  loescheTestSuperadmin,
  schliesseTestVerbindungen,
} from "./helpers.js";

const firma = await erstelleTestfirma("Superadmin Test");
await withFirma(firma, (client) =>
  client.query("INSERT INTO contacts (firma_id, nachname) VALUES ($1, 'Geheimer Kontakt')", [firma])
);

const email = `superadmin-${crypto.randomUUID()}@example.test`;
const hash = await hashPassword("Ein-Sicheres-Passwort-12");
await erstelleTestSuperadmin(email, hash);

after(async () => {
  await loescheTestSuperadmin(email);
  await loescheTestfirma(firma);
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Superadmin (keine Firma) sieht keine Kontakte", async () => {
  const { rows } = await pool.query("SELECT * FROM contacts");
  assert.equal(rows.length, 0);
});

test("Superadmin (keine Firma) sieht keine Notizen", async () => {
  const { rows } = await pool.query("SELECT * FROM notes");
  assert.equal(rows.length, 0);
});

test("Superadmin (keine Firma) sieht keine Aufgaben", async () => {
  const { rows } = await pool.query("SELECT * FROM tasks");
  assert.equal(rows.length, 0);
});
