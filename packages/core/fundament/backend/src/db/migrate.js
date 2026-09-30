import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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
    let sql = await readFile(path.join(migrationsDir, file), "utf8");
    sql = sql.replaceAll("__APP_DB_PASSWORD__", APP_DB_PASSWORD);
    console.log(`Migration: ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  await client.end();
  console.log("Datenbank ist aktuell.");
}

run().catch((err) => {
  console.error("Migration fehlgeschlagen:", err.message);
  process.exit(1);
});
