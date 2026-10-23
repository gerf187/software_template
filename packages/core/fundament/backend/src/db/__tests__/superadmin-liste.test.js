import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import { listeSuperadmins } from "../superadmin-liste.js";
import { hashPassword } from "../../auth/password.js";
import { erstelleTestSuperadmin, loescheTestSuperadmin, schliesseTestVerbindungen } from "./helpers.js";

const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
const eigentuemer = new pg.Pool({
  connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
});

const emailOhneLogin = `liste-ohne-login-${crypto.randomUUID()}@example.test`;
const emailMitLogin = `liste-mit-login-${crypto.randomUUID()}@example.test`;

after(async () => {
  await loescheTestSuperadmin(emailOhneLogin);
  await loescheTestSuperadmin(emailMitLogin);
  await eigentuemer.end();
  await schliesseTestVerbindungen();
});

test("Zeigt alle Superadmin-Konten mit Status und letztem erfolgreichen Login", async () => {
  await erstelleTestSuperadmin(emailOhneLogin, await hashPassword("Ein-Kennwort-ohne-Login-1"));
  await erstelleTestSuperadmin(emailMitLogin, await hashPassword("Ein-Kennwort-mit-Login-12"));
  await eigentuemer.query("INSERT INTO login_versuche (email, erfolgreich) VALUES ($1, true)", [emailMitLogin]);

  const liste = await listeSuperadmins(eigentuemer);

  const ohneLogin = liste.find((s) => s.email === emailOhneLogin);
  const mitLogin = liste.find((s) => s.email === emailMitLogin);
  assert.ok(ohneLogin, "Konto ohne Login muss in der Liste auftauchen");
  assert.ok(mitLogin, "Konto mit Login muss in der Liste auftauchen");
  assert.equal(ohneLogin.aktiv, true);
  assert.equal(ohneLogin.letzter_login, null);
  assert.ok(mitLogin.letzter_login, "Letzter erfolgreicher Login muss gesetzt sein");
});
