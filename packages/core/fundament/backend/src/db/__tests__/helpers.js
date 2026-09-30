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

export async function schliesseTestVerbindungen() {
  await ownerPool.end();
}
