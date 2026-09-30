// Demo-Daten für die Werkstatt (Björns Testumgebung). Jederzeit erneut
// ausführbar: löscht zuerst alle bisherigen Werkstatt-Demo-Daten und legt
// sie frisch an -- "zurücksetzen" statt "zusammenführen".
import { pool } from "./pool.js";
import { withFirma } from "./withFirma.js";
import { hashPassword } from "../auth/password.js";
import pg from "pg";

const {
  POSTGRES_HOST,
  POSTGRES_PORT,
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
} = process.env;
const ownerPool = new pg.Pool({
  connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
});

const PASSWORT = "Werkstatt-Test-2026";
const SLUG_A = "werkstatt-demo-a";
const SLUG_B = "werkstatt-demo-b";
const SUPERADMIN_EMAIL = "superadmin@werkstatt.test";

async function zuruecksetzen() {
  const { rows } = await pool.query("SELECT id FROM firmen WHERE slug = ANY($1)", [
    [SLUG_A, SLUG_B],
  ]);
  for (const { id } of rows) {
    await ownerPool.query("DELETE FROM notes WHERE firma_id = $1", [id]);
    await ownerPool.query("DELETE FROM tasks WHERE firma_id = $1", [id]);
    await ownerPool.query("DELETE FROM sessions WHERE firma_id = $1", [id]);
    await ownerPool.query(
      "DELETE FROM login_versuche WHERE email IN (SELECT email FROM users WHERE firma_id = $1)",
      [id]
    );
    await ownerPool.query("DELETE FROM contacts WHERE firma_id = $1", [id]);
    await ownerPool.query("DELETE FROM users WHERE firma_id = $1", [id]);
  }
  await ownerPool.query("DELETE FROM firmen WHERE slug = ANY($1)", [[SLUG_A, SLUG_B]]);

  await ownerPool.query(
    "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)",
    [SUPERADMIN_EMAIL]
  );
  await ownerPool.query("DELETE FROM login_versuche WHERE lower(email) = lower($1)", [
    SUPERADMIN_EMAIL,
  ]);
  await ownerPool.query("DELETE FROM users WHERE email = $1", [SUPERADMIN_EMAIL]);
}

async function anlegen() {
  const hash = await hashPassword(PASSWORT);

  const firmaA = (
    await pool.query("INSERT INTO firmen (name, slug) VALUES ('Demo Firma A', $1) RETURNING id", [
      SLUG_A,
    ])
  ).rows[0].id;
  const firmaB = (
    await pool.query("INSERT INTO firmen (name, slug) VALUES ('Demo Firma B', $1) RETURNING id", [
      SLUG_B,
    ])
  ).rows[0].id;

  await withFirma(firmaA, async (client) => {
    await client.query(
      `INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES
       ($1, 'admin-a@werkstatt.test', $2, 'Admin (Firma A)', 'Admin'),
       ($1, 'mitarbeiter-a@werkstatt.test', $2, 'Mitarbeiter (Firma A)', 'Mitarbeiter'),
       ($1, 'betrachter-a@werkstatt.test', $2, 'Betrachter (Firma A)', 'Betrachter')`,
      [firmaA, hash]
    );
    const { rows } = await client.query(
      `INSERT INTO contacts (firma_id, name, email) VALUES
       ($1, 'Anna Beispiel', 'anna@beispiel.test'),
       ($1, 'Ben Muster', 'ben@muster.test')
       RETURNING id`,
      [firmaA]
    );
    await client.query(
      "INSERT INTO notes (firma_id, contact_id, text) VALUES ($1, $2, 'Erstgespräch war freundlich.')",
      [firmaA, rows[0].id]
    );
    await client.query(
      "INSERT INTO tasks (firma_id, contact_id, text, status) VALUES ($1, $2, 'Angebot nachfassen', 'offen')",
      [firmaA, rows[1].id]
    );
  });

  await withFirma(firmaB, async (client) => {
    await client.query(
      `INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES
       ($1, 'admin-b@werkstatt.test', $2, 'Admin (Firma B)', 'Admin')`,
      [firmaB, hash]
    );
    await client.query(
      "INSERT INTO contacts (firma_id, name, email) VALUES ($1, 'Clara Kontrolle', 'clara@kontrolle.test')",
      [firmaB]
    );
  });

  await ownerPool.query(
    `INSERT INTO users (firma_id, email, passwort_hash, name, rolle)
     VALUES (NULL, $1, $2, 'Superadmin', 'Superadmin')`,
    [SUPERADMIN_EMAIL, hash]
  );
}

async function run() {
  await zuruecksetzen();
  await anlegen();
  console.log(`Werkstatt-Demo-Daten stehen. Passwort für alle Test-Konten: ${PASSWORT}`);
  console.log("  admin-a@werkstatt.test        -- Admin, Demo Firma A");
  console.log("  mitarbeiter-a@werkstatt.test  -- Mitarbeiter, Demo Firma A");
  console.log("  betrachter-a@werkstatt.test   -- Betrachter, Demo Firma A");
  console.log("  admin-b@werkstatt.test        -- Admin, Demo Firma B");
  console.log("  superadmin@werkstatt.test     -- Superadmin, keine Firma");
  await ownerPool.end();
  await pool.end();
}

run().catch((err) => {
  console.error("Werkstatt-Seed fehlgeschlagen:", err.message);
  process.exit(1);
});
