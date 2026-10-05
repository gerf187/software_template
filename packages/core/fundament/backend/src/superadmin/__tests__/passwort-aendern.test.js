import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import {
  erstelleTestSuperadmin,
  loescheTestSuperadmin,
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

const ALT = "Altes-Passwort-Superadmin-1";
const NEU = "Gruener-Tiger-Wolke-7429";
const email = `sa-pw-${crypto.randomUUID()}@example.test`;
const firmaId = await erstelleTestfirmaMitRechten("SA Passwort");

await erstelleTestSuperadmin(email, await hashPassword(ALT));

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestSuperadmin(email);
  await loescheTestfirma(firmaId);
  await schliesseTestVerbindungen();
  await pool.end();
});

async function login(passwort) {
  const res = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwort }),
  });
  return { status: res.status, cookie: res.headers.get("set-cookie") };
}

test("Superadmin kann sein Passwort ändern, danach klappt der Login nur mit dem neuen", async () => {
  const anmeldung = await login(ALT);
  assert.equal(anmeldung.status, 200);

  const aendern = await fetch(`${basis}/api/auth/passwort-aendern`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: anmeldung.cookie },
    body: JSON.stringify({ aktuellesPasswort: ALT, neuesPasswort: NEU }),
  });
  assert.equal(aendern.status, 200, `Passwortänderung: HTTP ${aendern.status}`);

  assert.equal((await login(ALT)).status, 401, "altes Passwort darf nicht mehr gehen");
  assert.equal((await login(NEU)).status, 200, "neues Passwort muss gehen");
});

test("Die Superadmin-Passwort-Funktionen greifen nicht auf normale Nutzer", async () => {
  const altHash = await hashPassword(ALT);
  const normalerNutzer = await withFirma(firmaId, (client) =>
    client
      .query(
        "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Normal', 'Admin') RETURNING id",
        [firmaId, `normal-${crypto.randomUUID()}@example.test`, altHash]
      )
      .then((r) => r.rows[0].id)
  );

  const lesen = await pool.query("SELECT * FROM superadmin_passwort_lesen($1)", [normalerNutzer]);
  assert.equal(lesen.rows.length, 0, "Funktion darf keinen normalen Nutzer liefern");

  const setzen = await pool.query("SELECT superadmin_passwort_setzen($1, $2) AS ok", [
    normalerNutzer,
    await hashPassword(NEU),
  ]);
  assert.equal(setzen.rows.length, 1);
  const { rows } = await withFirma(firmaId, (client) =>
    client.query("SELECT passwort_hash FROM users WHERE id = $1", [normalerNutzer])
  );
  assert.equal(await verifyPassword(ALT, rows[0].passwort_hash), true, "Hash eines normalen Nutzers darf nicht geändert werden");
});
