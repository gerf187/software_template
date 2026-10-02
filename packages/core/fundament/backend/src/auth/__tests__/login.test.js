import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { hashPassword } from "../password.js";
import {
  erstelleTestfirma,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

const PASSWORT = "Ein-Sicheres-Passwort-12";
const firma = await erstelleTestfirma("Login Test");

async function erstelleBenutzer(email, aktiv) {
  const hash = await hashPassword(PASSWORT);
  await withFirma(firma, (client) =>
    client.query(
      "INSERT INTO users (firma_id, email, passwort_hash, name, rolle, aktiv) VALUES ($1, $2, $3, 'Test', 'User', $4)",
      [firma, email, hash, aktiv]
    )
  );
}

const emailInaktiv = `inaktiv-${firma}@example.test`;
const emailSperrtest = `sperre-${firma}@example.test`;
await erstelleBenutzer(emailInaktiv, false);
await erstelleBenutzer(emailSperrtest, true);

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestfirma(firma);
  await schliesseTestVerbindungen();
  await pool.end();
});

function login(email, passwort) {
  return fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwort }),
  });
}

test("Inaktiver Nutzer kann sich mit richtigem Passwort nicht anmelden", async () => {
  const res = await login(emailInaktiv, PASSWORT);
  assert.equal(res.status, 401);
});

test("Nach 5 Fehlversuchen ist die Anmeldung gesperrt, auch mit richtigem Passwort", async () => {
  for (let i = 0; i < 5; i++) {
    const res = await login(emailSperrtest, "falsches-passwort");
    assert.equal(res.status, 401);
  }

  const sechster = await login(emailSperrtest, "falsches-passwort");
  assert.equal(sechster.status, 429);

  const mitRichtigemPasswort = await login(emailSperrtest, PASSWORT);
  assert.equal(mitRichtigemPasswort.status, 429);
});
