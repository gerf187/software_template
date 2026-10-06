// Demo-Daten für die Werkstatt (Björns Testumgebung). Jederzeit erneut
// ausführbar: löscht zuerst alle bisherigen Werkstatt-Demo-Daten und legt
// sie frisch an -- "zurücksetzen" statt "zusammenführen".
import { pool } from "./pool.js";
import { withFirma } from "./withFirma.js";
import { hashPassword } from "../auth/password.js";
import { WERKSTATT_PASSWORT } from "../werkstatt/nutzer.js";
import { rechteStandardAnlegen, rechteFuerBausteinAnlegen } from "../rechte/standardAnlegen.js";
import { ladeModule } from "../module/lade.js";
import appConfig from "../appConfig.js";
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

const PASSWORT = WERKSTATT_PASSWORT;
const SLUG_A = "werkstatt-demo-a";
const SLUG_B = "werkstatt-demo-b";
const SUPERADMIN_EMAIL = "superadmin@werkstatt.test";

// empfohlenVonIndex zeigt auf einen vorherigen Eintrag in derselben Liste
// (Empfehlungsketten, Abschnitt 11).
const KONTAKTE_FIRMA_A = [
  { vorname: "Anna", nachname: "Schmidt", email: "anna.schmidt@beispiel.test", telefon: "0221 1234567", mobil: "0171 1111111", wohnadresse_strasse: "Blumenstr. 1", wohnadresse_plz: "50667", wohnadresse_ort: "Köln", empfohlenVonText: "Google" },
  { vorname: "Ben", nachname: "Fischer", email: "ben.fischer@beispiel.test", telefon: "0221 2222222", empfohlenVonIndex: 0 },
  { vorname: "Clara", nachname: "Weber", email: "clara.weber@beispiel.test", empfohlenVonText: "Empfehlung Nachbar" },
  { vorname: "David", nachname: "Hoffmann", organisation: "Hoffmann Bau GmbH", email: "david@hoffmann-bau.test" },
  { vorname: "Eva", nachname: "Wagner", email: "eva.wagner@beispiel.test", empfohlenVonIndex: 1 },
  { vorname: "Felix", nachname: "Becker", email: "felix.becker@beispiel.test" },
  { vorname: "Greta", nachname: "Schulz", email: "greta.schulz@beispiel.test", empfohlenVonText: "Facebook-Anzeige" },
  { vorname: "Hannes", nachname: "Koch", organisation: "Koch Dachdecker", email: "hannes@koch-dach.test" },
  { vorname: "Ina", nachname: "Richter", email: "ina.richter@beispiel.test", empfohlenVonIndex: 2 },
  { vorname: "Jonas", nachname: "Klein", email: "jonas.klein@beispiel.test" },
  { vorname: "Katrin", nachname: "Wolf", email: "katrin.wolf@beispiel.test", empfohlenVonText: "Messe 2025" },
  { vorname: "Lukas", nachname: "Neumann", organisation: "Neumann Elektro", email: "lukas@neumann-elektro.test" },
  { vorname: "Maria", nachname: "Schwarz", email: "maria.schwarz@beispiel.test", empfohlenVonIndex: 3 },
  { vorname: "Niklas", nachname: "Zimmermann", email: "niklas.zimmermann@beispiel.test" },
  { vorname: "Olivia", nachname: "König", email: "olivia.koenig@beispiel.test", empfohlenVonText: "Mundpropaganda" },
];

const KONTAKTE_FIRMA_B = [
  { vorname: "Paul", nachname: "Krüger", email: "paul.krueger@kontrolle.test" },
  { vorname: "Quinn", nachname: "Lorenz", email: "quinn.lorenz@kontrolle.test", empfohlenVonText: "Google" },
  { vorname: "Rosa", nachname: "Vogel", email: "rosa.vogel@kontrolle.test" },
  { vorname: "Stefan", nachname: "Huber", organisation: "Huber Sanitär", email: "stefan@huber-sanitaer.test" },
  { vorname: "Tina", nachname: "Albrecht", email: "tina.albrecht@kontrolle.test", empfohlenVonIndex: 0 },
];

async function kontakteAnlegen(client, firmaId, liste) {
  const ids = [];
  for (const k of liste) {
    const empfohlenVonKontaktId = k.empfohlenVonIndex != null ? ids[k.empfohlenVonIndex] : null;
    const { rows } = await client.query(
      `INSERT INTO contacts
         (firma_id, anrede, vorname, nachname, organisation, email, telefon, mobil,
          wohnadresse_strasse, wohnadresse_plz, wohnadresse_ort,
          empfohlen_von_kontakt_id, empfohlen_von_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        firmaId,
        k.anrede || null,
        k.vorname,
        k.nachname,
        k.organisation || null,
        k.email || null,
        k.telefon || null,
        k.mobil || null,
        k.wohnadresse_strasse || null,
        k.wohnadresse_plz || null,
        k.wohnadresse_ort || null,
        empfohlenVonKontaktId,
        k.empfohlenVonText || null,
      ]
    );
    ids.push(rows[0].id);
  }
  return ids;
}

export async function werkstattDatenZuruecksetzen() {
  const { rows } = await pool.query("SELECT id FROM firmen WHERE slug = ANY($1)", [
    [SLUG_A, SLUG_B],
  ]);
  for (const { id } of rows) {
    await ownerPool.query("DELETE FROM notes WHERE firma_id = $1", [id]);
    await ownerPool.query("DELETE FROM tasks WHERE firma_id = $1", [id]);
    await ownerPool.query("DELETE FROM benutzer_dashboard WHERE firma_id = $1", [id]);
    await ownerPool.query("DELETE FROM contacts WHERE firma_id = $1", [id]);
    // Erst nach den Fachtabellen: deren Löschen trägt selbst noch ins
    // Änderungsprotokoll ein (Trigger). Auch vor "users", weil das Protokoll
    // per Fremdschlüssel auf den Benutzer verweist.
    await ownerPool.query("DELETE FROM aenderungsprotokoll WHERE firma_id = $1", [id]);
    await ownerPool.query("DELETE FROM sessions WHERE firma_id = $1", [id]);
    await ownerPool.query(
      "DELETE FROM login_versuche WHERE email IN (SELECT email FROM users WHERE firma_id = $1)",
      [id]
    );
    await ownerPool.query("DELETE FROM users WHERE firma_id = $1", [id]);
    // Das Löschen der Nutzer trägt selbst ins Protokoll ein (Trigger) -- diese
    // Zeilen müssen weg, bevor die Firma gelöscht werden kann.
    await ownerPool.query("DELETE FROM rechte WHERE firma_id = $1", [id]);
    // firma_module zuerst: dort erzeugt das Löschen selbst Protokoll-Einträge.
    await ownerPool.query("DELETE FROM firma_module WHERE firma_id = $1", [id]);
    await ownerPool.query("DELETE FROM aenderungsprotokoll WHERE firma_id = $1", [id]);
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

export async function werkstattDatenAnlegen() {
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
    await rechteStandardAnlegen(client, firmaA, appConfig.standardRechte);
    await client.query(
      `INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES
       ($1, 'admin-a@werkstatt.test', $2, 'Admin (Firma A)', 'Admin'),
       ($1, 'user-a@werkstatt.test', $2, 'User (Firma A)', 'User')`,
      [firmaA, hash]
    );
    const idsA = await kontakteAnlegen(client, firmaA, KONTAKTE_FIRMA_A);

    await client.query(
      `INSERT INTO notes (firma_id, contact_id, text) VALUES
       ($1, $2, 'Erstgespräch war freundlich.'),
       ($1, $3, 'Interessiert sich für ein Komplettangebot.'),
       ($1, $4, 'Rückruf gewünscht, am besten nachmittags.')`,
      [firmaA, idsA[0], idsA[3], idsA[7]]
    );
    await client.query(
      `INSERT INTO tasks (firma_id, contact_id, text, status, faellig_am) VALUES
       ($1, $2, 'Angebot nachfassen', 'offen', current_date + 3),
       ($1, $3, 'Unterlagen anfordern', 'offen', current_date + 7),
       ($1, $4, 'Termin vor Ort vereinbaren', 'erledigt', current_date - 2),
       ($1, $5, 'Rückruf -- überfällig', 'offen', current_date - 1)`,
      [firmaA, idsA[1], idsA[4], idsA[9], idsA[2]]
    );

    // Baustein "beispiel" für Firma A schon freigeschaltet, damit die
    // Dashboard-Kachel eines Bausteins (Abschnitt 8/10) sofort zu sehen ist,
    // ohne erst über die Superadmin-Seite "Bausteine" gehen zu müssen.
    const module = await ladeModule();
    const beispielConfig = module.find((m) => m.name === "beispiel")?.config;
    await client.query(
      "INSERT INTO firma_module (firma_id, modul, aktiv) VALUES ($1, 'beispiel', true)",
      [firmaA]
    );
    await rechteFuerBausteinAnlegen(client, firmaA, beispielConfig?.rechteBereiche);
  });

  await withFirma(firmaB, async (client) => {
    await rechteStandardAnlegen(client, firmaB, appConfig.standardRechte);
    await client.query(
      `INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES
       ($1, 'admin-b@werkstatt.test', $2, 'Admin (Firma B)', 'Admin')`,
      [firmaB, hash]
    );
    const idsB = await kontakteAnlegen(client, firmaB, KONTAKTE_FIRMA_B);
    await client.query(
      "INSERT INTO notes (firma_id, contact_id, text) VALUES ($1, $2, 'Nur für den Trennungstest -- darf Firma A nie sehen.')",
      [firmaB, idsB[0]]
    );
  });

  await ownerPool.query(
    `INSERT INTO users (firma_id, email, passwort_hash, name, rolle)
     VALUES (NULL, $1, $2, 'Superadmin', 'Superadmin')`,
    [SUPERADMIN_EMAIL, hash]
  );
}

async function run() {
  await werkstattDatenZuruecksetzen();
  await werkstattDatenAnlegen();
  console.log(`Werkstatt-Demo-Daten stehen. Passwort für alle Test-Konten: ${PASSWORT}`);
  console.log("  admin-a@werkstatt.test        -- Admin, Demo Firma A");
  console.log("  user-a@werkstatt.test         -- User, Demo Firma A");
  console.log("  admin-b@werkstatt.test        -- Admin, Demo Firma B");
  console.log("  superadmin@werkstatt.test     -- Superadmin, keine Firma");
  await ownerPool.end();
  await pool.end();
}

// Nur automatisch ausführen, wenn die Datei direkt gestartet wird (npm
// run db:seed:werkstatt) -- nicht, wenn Tests nur die Funktionen importieren.
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error("Werkstatt-Seed fehlgeschlagen:", err.message);
    process.exit(1);
  });
}
