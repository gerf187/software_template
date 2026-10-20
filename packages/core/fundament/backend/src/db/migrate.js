import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { modulOrdner } from "../module/lade.js";
import appConfig, { appName } from "../appConfig.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, "../../db/migrations");

const {
  POSTGRES_HOST,
  POSTGRES_PORT,
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  APP_DB_PASSWORD,
} = process.env;

if (!POSTGRES_USER || !POSTGRES_PASSWORD || !APP_DB_PASSWORD) {
  console.error(
    "Datenbank-Zugang fehlt. Bitte zuerst im Projekt-Wurzelverzeichnis: cp .env.example .env"
  );
  process.exit(1);
}

const connectionString = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;

async function existiert(ordner) {
  try {
    await access(ordner);
    return true;
  } catch {
    return false;
  }
}

// Eine Migrationen-Datei ausführen und in _migrations eintragen -- "name" ist
// der eindeutige Schlüssel (für Bausteine mit Namens-Vorsatz, siehe unten).
async function wendeAn(client, ordner, datei, name) {
  let sql = await readFile(path.join(ordner, datei), "utf8");
  sql = sql.replaceAll("__APP_DB_PASSWORD__", APP_DB_PASSWORD);
  console.log(`Migration: ${name}`);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function run() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      ausgefuehrt_am TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query("SELECT name FROM _migrations");
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    await wendeAn(client, migrationsDir, file, file);
  }

  // Bausteine (Abschnitt 5/8): jeder Baustein bringt seine Tabellen selbst mit
  // (db/migrations im eigenen Ordner), unabhängig davon, ob ihn schon eine
  // Firma freigeschaltet hat -- firma_module entscheidet nur über die Nutzung,
  // nicht über das Datenbank-Schema. Reihenfolge wie in app.config.js (module).
  for (const name of appConfig.module || []) {
    const ordner = await modulOrdner(name, { app: appName });
    const modulMigrationen = path.join(ordner, "db/migrations");
    if (!(await existiert(modulMigrationen))) continue;

    const modulDateien = (await readdir(modulMigrationen)).filter((f) => f.endsWith(".sql")).sort();
    for (const datei of modulDateien) {
      const eintragsname = `modul:${name}:${datei}`;
      if (applied.has(eintragsname)) continue;
      await wendeAn(client, modulMigrationen, datei, eintragsname);
    }
  }

  await client.end();
  console.log("Datenbank ist aktuell.");
}

run().catch((err) => {
  console.error("Migration fehlgeschlagen:", err.message);
  process.exit(1);
});
