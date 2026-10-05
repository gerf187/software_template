import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { pool } from "../pool.js";
import { withFirma } from "../withFirma.js";
import { hashPassword } from "../../auth/password.js";
import {
  erstelleTestfirma,
  erstelleTestSuperadmin,
  loescheTestSuperadmin,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "./helpers.js";

// Mitarbeiter-Änderungen gehören ins Protokoll (Abschnitt 6), das Passwort-
// Hash aber nie (Hash-Werte dürfen nicht dauerhaft gespeichert werden).

const firmaId = await erstelleTestfirma("Protokoll Users");
const emailSuperadmin = `sa-protokoll-${crypto.randomUUID()}@example.test`;

after(async () => {
  await loescheTestSuperadmin(emailSuperadmin);
  await loescheTestfirma(firmaId);
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Rolle ändern erzeugt einen Protokoll-Eintrag ohne passwort_hash", async () => {
  const hash = await hashPassword("Ein-Sicheres-Passwort-12");
  const userId = await withFirma(firmaId, (client) =>
    client
      .query(
        "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Mitarbeiter', 'User') RETURNING id",
        [firmaId, `mitarbeiter-${crypto.randomUUID()}@example.test`, hash]
      )
      .then((r) => r.rows[0].id)
  );

  await withFirma(
    firmaId,
    (client) => client.query("UPDATE users SET rolle = 'Admin' WHERE id = $1", [userId]),
    { userId }
  );

  const rows = await withFirma(firmaId, (client) =>
    client
      .query(
        "SELECT aktion, alte_werte, neue_werte FROM aenderungsprotokoll WHERE tabelle = 'users' AND datensatz_id = $1 AND aktion = 'geaendert'",
        [userId]
      )
      .then((r) => r.rows)
  );
  assert.equal(rows.length, 1, "Rollenwechsel muss protokolliert werden");
  assert.equal(rows[0].alte_werte.rolle, "User");
  assert.equal(rows[0].neue_werte.rolle, "Admin");
  assert.equal("passwort_hash" in rows[0].alte_werte, false, "alte Werte enthalten kein Passwort-Hash");
  assert.equal("passwort_hash" in rows[0].neue_werte, false, "neue Werte enthalten kein Passwort-Hash");
});

test("Superadmin-Passwortwechsel läuft ohne Fehler durch (keine Firma, wird nicht protokolliert)", async () => {
  const saId = await erstelleTestSuperadmin(emailSuperadmin, await hashPassword("Alt-Superadmin-Passwort-1"));
  const neuerHash = await hashPassword("Neu-Superadmin-Wolke-7429");
  const { rows } = await pool.query("SELECT superadmin_passwort_setzen($1, $2) AS ok", [saId, neuerHash]);
  assert.equal(rows[0].ok, true);
});
