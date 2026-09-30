// Nur für die lokale Entwicklung: legt eine Testfirma mit einem Test-Login an.
import { pool } from "./pool.js";
import { withFirma } from "./withFirma.js";
import { hashPassword } from "../auth/password.js";

const EMAIL = "admin@testfirma.de";
const PASSWORT = "Testpasswort-2026";

async function seed() {
  const { rows } = await pool.query(
    `INSERT INTO firmen (name, slug) VALUES ('Testfirma', 'testfirma')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  const firmaId = rows[0].id;

  const hash = await hashPassword(PASSWORT);

  await withFirma(firmaId, (client) =>
    client.query(
      `INSERT INTO users (firma_id, email, passwort_hash, name, rolle)
       VALUES ($1, $2, $3, 'Admin', 'Admin')
       ON CONFLICT (lower(email)) DO NOTHING`,
      [firmaId, EMAIL, hash]
    )
  );

  console.log(`Testfirma bereit. Login: ${EMAIL} / ${PASSWORT}`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed fehlgeschlagen:", err.message);
  process.exit(1);
});
