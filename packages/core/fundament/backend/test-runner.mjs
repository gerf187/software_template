// Startet die Backend-Tests gegen eine eigene Test-Datenbank (saas_test), nie gegen
// die Werkstatt- oder Entwicklungs-Datenbank. Vorher wird die Test-Datenbank angelegt
// und migriert. Aufruf: npm test (siehe package.json).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const TEST_DB = "saas_test";
const dirname = path.dirname(fileURLToPath(import.meta.url));
const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env;

if (POSTGRES_DB === TEST_DB) {
  console.error(`Abbruch: POSTGRES_DB ist bereits ${TEST_DB}. Bitte die Entwicklungs-Datenbank in .env angeben.`);
  process.exit(1);
}

// 1. Test-Datenbank anlegen, falls nötig (über die Verbindung zur Datenbank "postgres")
const verwaltung = new pg.Client({
  connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/postgres`,
});
await verwaltung.connect();
const { rows } = await verwaltung.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB]);
if (rows.length === 0) {
  await verwaltung.query(`CREATE DATABASE ${TEST_DB}`);
  console.log(`Test-Datenbank ${TEST_DB} angelegt.`);
}
await verwaltung.end();

const umgebung = { ...process.env, POSTGRES_DB: TEST_DB };

// 2. Migrationen einspielen
const migrate = spawnSync(process.execPath, [path.join(dirname, "src/db/migrate.js")], {
  env: umgebung,
  stdio: "inherit",
});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

// 3. Alle Testdateien einsammeln (src/**/__tests__/*.test.js)
function finde(ordner) {
  if (!fs.existsSync(ordner)) return [];
  return fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const pfad = path.join(ordner, e.name);
    if (e.isDirectory()) return finde(pfad);
    return e.name.endsWith(".test.js") && pfad.includes(`${path.sep}__tests__${path.sep}`) ? [pfad] : [];
  });
}
const dateien = finde(path.join(dirname, "src")).map((p) => path.relative(dirname, p));

// Bausteine bringen ihre eigenen Tests mit (Abschnitt 12, Werkstatt: "Jeder
// Baustein bekommt zusätzlich automatische Tests"). Gleiche Reihenfolge wie
// die Datenbank-Migrationen eines Bausteins (migrate.js): app.config.js der
// laufenden App legt fest, welche Bausteine das betrifft.
const { default: appConfig, appName: laufendeApp } = await import("./src/appConfig.js");
const { modulOrdner } = await import("./src/module/lade.js");
for (const name of appConfig.module || []) {
  const ordner = await modulOrdner(name, { app: laufendeApp });
  const modulTests = finde(path.join(ordner, "backend/__tests__")).map((p) =>
    path.relative(dirname, p)
  );
  dateien.push(...modulTests);
}

// 4. Tests laufen lassen
const tests = spawnSync(process.execPath, ["--test", ...dateien], { env: umgebung, stdio: "inherit" });
process.exit(tests.status ?? 1);
