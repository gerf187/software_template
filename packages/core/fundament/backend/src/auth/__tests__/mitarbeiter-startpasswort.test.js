import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { hashPassword } from "../password.js";
import {
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

// Weg aus dem Klicktest: Admin lädt einen Mitarbeiter ein, der Mitarbeiter meldet
// sich mit dem Startpasswort an und ändert es. Muss ohne Umwege klappen.

const PASSWORT_ADMIN = "Admin-Start-Passwort-Zeile7";
const firmaId = await erstelleTestfirmaMitRechten("Startpasswort Mitarbeiter");
const adminEmail = `admin-sp-${firmaId}@example.test`;
await withFirma(firmaId, async (client) =>
  client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Admin', 'Admin')",
    [firmaId, adminEmail, await hashPassword(PASSWORT_ADMIN)]
  )
);

const server = createApp({ appName: "energieberater", production: false }).listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestfirma(firmaId);
  await schliesseTestVerbindungen();
  await pool.end();
});

function api(method, pfad, { cookie, body } = {}) {
  return fetch(`${basis}${pfad}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: basis,
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function login(email, passwort) {
  const res = await api("POST", "/api/auth/login", { body: { email, passwort } });
  return { status: res.status, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}

test("Mitarbeiter: Einladung, Anmeldung mit Startpasswort, Passwortwechsel klappen", async () => {
  const admin = await login(adminEmail, PASSWORT_ADMIN);
  assert.equal(admin.status, 200);

  const einladung = await api("POST", "/api/mitarbeiter", {
    cookie: admin.cookie,
    body: { email: `mitarbeiter-sp-${firmaId}@example.test`, name: "Mitarbeiter", rolle: "User" },
  });
  assert.equal(einladung.status, 201);
  const { startpasswort } = await einladung.json();

  const mitarbeiter = await login(`mitarbeiter-sp-${firmaId}@example.test`, startpasswort);
  assert.equal(mitarbeiter.status, 200, "Anmeldung mit dem Startpasswort");

  const neu = "Eigenes-Neues-Zeichen-7319";
  const wechsel = await api("POST", "/api/auth/passwort-aendern", {
    cookie: mitarbeiter.cookie,
    body: { aktuellesPasswort: startpasswort, neuesPasswort: neu },
  });
  assert.equal(wechsel.status, 200, "Passwortwechsel mit dem Startpasswort als aktuelles Passwort");

  const mitNeu = await login(`mitarbeiter-sp-${firmaId}@example.test`, neu);
  assert.equal(mitNeu.status, 200, "Anmeldung mit dem neuen Passwort");
});
