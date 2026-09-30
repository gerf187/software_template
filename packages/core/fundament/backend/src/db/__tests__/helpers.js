import crypto from "node:crypto";
import pg from "pg";
import { pool } from "../pool.js";

// Aufräumen nach Tests läuft über den Eigentümer-Zugang, nicht über die
// eingeschränkte "app"-Rolle -- sonst würde die eigene Mandanten-Trennung
// das Löschen der Testdaten verhindern.
const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
const ownerPool = new pg.Pool({
  connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
});

export async function erstelleTestfirma(namePrefix) {
  const eindeutig = crypto.randomUUID();
  const { rows } = await pool.query(
    "INSERT INTO firmen (name, slug) VALUES ($1, $2) RETURNING id",
    [`${namePrefix} ${eindeutig}`, `${namePrefix}-${eindeutig}`]
  );
  return rows[0].id;
}

export async function loescheTestfirma(firmaId) {
  await ownerPool.query("DELETE FROM notes WHERE firma_id = $1", [firmaId]);
  await ownerPool.query("DELETE FROM tasks WHERE firma_id = $1", [firmaId]);
  await ownerPool.query("DELETE FROM sessions WHERE firma_id = $1", [firmaId]);
  await ownerPool.query("DELETE FROM login_versuche WHERE email IN (SELECT email FROM users WHERE firma_id = $1)", [firmaId]);
  await ownerPool.query("DELETE FROM contacts WHERE firma_id = $1", [firmaId]);
  await ownerPool.query("DELETE FROM users WHERE firma_id = $1", [firmaId]);
  await ownerPool.query("DELETE FROM firmen WHERE id = $1", [firmaId]);
}

// Ein Superadmin hat keine Firma (firma_id NULL). Die normale "app"-Rolle
// dürfte so eine Zeile gar nicht anlegen -- die Mandanten-Trennung würde das
// als Regelverstoß ablehnen (WITH CHECK). Das ist gewollt: Superadmin-Konten
// entstehen nie über den normalen Betrieb, sondern nur über diesen
// privilegierten Weg (genau wie später eine echte Superadmin-Verwaltung
// das machen müsste).
export async function erstelleTestSuperadmin(email, passwortHash) {
  const { rows } = await ownerPool.query(
    `INSERT INTO users (firma_id, email, passwort_hash, name, rolle)
     VALUES (NULL, $1, $2, 'Superadmin', 'Superadmin') RETURNING id`,
    [email, passwortHash]
  );
  return rows[0].id;
}

export async function loescheTestSuperadmin(email) {
  await ownerPool.query(
    "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)",
    [email]
  );
  await ownerPool.query("DELETE FROM login_versuche WHERE lower(email) = lower($1)", [email]);
  await ownerPool.query("DELETE FROM users WHERE email = $1", [email]);
}

export async function schliesseTestVerbindungen() {
  await ownerPool.end();
}
