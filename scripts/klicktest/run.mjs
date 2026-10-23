// Automatischer Klicktest gegen die Werkstatt (Teil D). Eigene Datenbank
// (saas_klicktest) und eigener Port -- ein laufendes "npm run dev" (Datenbank
// "saas", Port 3001/5173) bleibt unberührt. Aufruf: npm run klicktest
// (Projekt-Wurzelverzeichnis). Playwright/Chromium stecken bewusst in diesem
// eigenständigen Ordner (eigene package.json, kein npm-Workspace) -- das
// Dockerfile kopiert "scripts/" nie, Chromium landet also nie im Produktiv-Image.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";

const DB_NAME = "saas_klicktest";
const PORT = 3099;
const BASIS = `http://localhost:${PORT}`;

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "../..");
const backendDir = path.join(repoRoot, "packages/core/fundament/backend");
const frontendDir = path.join(repoRoot, "packages/core/fundament/frontend");
const frontendDist = path.join(frontendDir, "dist");
const screenshotDir = path.join(repoRoot, "klicktest-screenshots");

const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, APP_DB_PASSWORD } = process.env;
if (!POSTGRES_USER || !POSTGRES_PASSWORD || !APP_DB_PASSWORD) {
  console.error(
    "Abbruch: Datenbank-Zugang fehlt (.env). Bitte zuerst im Projekt-Wurzelverzeichnis: cp .env.example .env"
  );
  process.exit(1);
}

// Eigene Umgebung für jeden Schritt: eigene Datenbank, feste App (Werkstatt),
// nie mit NODE_ENV=production (die Werkstatt lehnt das sonst ab).
const umgebung = {
  ...process.env,
  POSTGRES_DB: DB_NAME,
  APP_NAME: "werkstatt",
  PORT: String(PORT),
  FRONTEND_ORDNER: frontendDist,
  NODE_ENV: "",
};

let schritt = 0;
function log(text) {
  console.log(`[klicktest] ${text}`);
}

// Jeder Lauf startet mit einer sauberen, leeren Datenbank -- sonst sammeln
// sich Testfirmen aus vorherigen (auch fehlgeschlagenen) Läufen an und der
// nächste Lauf prüft gegen die falschen Daten.
async function datenbankNeuAnlegen() {
  const verwaltung = new pg.Client({
    connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/postgres`,
  });
  await verwaltung.connect();
  await verwaltung.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [DB_NAME]
  );
  await verwaltung.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await verwaltung.query(`CREATE DATABASE ${DB_NAME}`);
  await verwaltung.end();
  log(`Datenbank ${DB_NAME} neu angelegt.`);
}

function laufenLassen(befehl, args, cwd) {
  const ergebnis = spawnSync(befehl, args, { cwd, env: umgebung, stdio: "inherit" });
  if (ergebnis.status !== 0) {
    throw new Error(`Befehl fehlgeschlagen: ${befehl} ${args.join(" ")}`);
  }
}

function backendStarten() {
  const prozess = spawn(process.execPath, ["src/index.js"], {
    cwd: backendDir,
    env: umgebung,
    stdio: "pipe",
  });
  prozess.stdout.on("data", (d) => process.stdout.write(`[backend] ${d}`));
  prozess.stderr.on("data", (d) => process.stderr.write(`[backend] ${d}`));
  return prozess;
}

async function aufGesundheitWarten() {
  for (let versuch = 0; versuch < 60; versuch++) {
    try {
      const res = await fetch(`${BASIS}/api/health`);
      if (res.ok) return;
    } catch {
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Backend wurde nach 30 Sekunden nicht erreichbar.");
}

async function screenshot(page, name) {
  schritt += 1;
  const datei = path.join(screenshotDir, `${String(schritt).padStart(2, "0")}_${name}.png`);
  await page.screenshot({ path: datei, fullPage: true });
  log(`Screenshot: ${path.relative(repoRoot, datei)}`);
}

async function anmelden(page, email, passwort) {
  await page.goto(`${BASIS}/login`);
  await page.locator("#login-email").fill(email);
  await page.locator("#login-passwort").fill(passwort);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL(`${BASIS}/`);
}

async function abmelden(page) {
  await page.getByRole("button", { name: "Abmelden" }).click();
  await page.waitForURL(`${BASIS}/login`);
}

async function ablaufDurchfuehren() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const DUBLETTEN_NAME = "Demo Firma A";
  const NEUE_FIRMA_NAME = `Klicktest-Firma ${Date.now()}`;

  try {
    // 1) Login Superadmin → Firmenliste
    log("Login Superadmin");
    await anmelden(page, "superadmin@werkstatt.test", "Werkstatt-Test-2026");
    await screenshot(page, "login_superadmin");

    log("Firmenliste öffnen");
    await page.getByRole("link", { name: "Firmen" }).click();
    await page.waitForURL(`${BASIS}/superadmin/firmen`);
    await page.getByRole("heading", { name: "Firmen" }).waitFor();
    await screenshot(page, "firmenliste");

    // 2) Firma neu (ohne Admin)
    log("Neue Firma öffnen");
    await page.getByRole("button", { name: "Neue Firma" }).click();
    await page.getByLabel("Firmenname").fill(DUBLETTEN_NAME);
    await page.getByLabel("Straße und Hausnummer").fill("Teststraße 1");
    await page.getByLabel("PLZ").fill("54321");
    await page.getByLabel("Ort").fill("Teststadt");
    await page.getByLabel("Ansprechpartner").fill("Klicktest Person");
    await page.getByLabel("Rechnungs-E-Mail").fill("klicktest@example.test");

    // 3) Dublette-Warnung (Name "Demo Firma A" gibt es schon)
    log("Dublette-Warnung prüfen");
    await page.getByText(`Es gibt bereits eine Firma mit diesem Namen`).waitFor();
    await screenshot(page, "dublette_warnung");

    // 4) PLZ "123" Fehler
    log("PLZ-Fehler prüfen");
    await page.getByLabel("PLZ").fill("123");
    await page.getByRole("button", { name: "Anlegen" }).click();
    await page.locator(".message-fehler").getByText(/PLZ/).waitFor();
    await screenshot(page, "plz_fehler");

    // 5) USt-IdNr falsch
    log("USt-IdNr-Fehler prüfen");
    await page.getByLabel("PLZ").fill("54321");
    await page.getByLabel("USt-IdNr.").fill("ATU12345678");
    await page.getByRole("button", { name: "Anlegen" }).click();
    await page.locator(".message-fehler").getByText(/USt-IdNr/).waitFor();
    await screenshot(page, "ust_id_nr_fehler");

    // Jetzt korrekt anlegen (Name bleibt absichtlich eine Dublette -- erlaubt).
    log("Firma mit korrigierten Daten anlegen");
    await page.getByLabel("Firmenname").fill(NEUE_FIRMA_NAME);
    await page.getByLabel("USt-IdNr.").fill("");
    await page.getByRole("button", { name: "Anlegen" }).click();
    await page.getByRole("heading", { name: "Firmen" }).waitFor();
    await page.getByText(NEUE_FIRMA_NAME).first().waitFor();
    await screenshot(page, "firma_angelegt");

    // 6) sperren → löschen (Aufräumen der Testfirma)
    log("Firma sperren");
    await page.getByText(NEUE_FIRMA_NAME).first().click();
    await page.getByRole("button", { name: "Sperren" }).click();
    await page.getByText(NEUE_FIRMA_NAME).first().click();
    await page.getByRole("button", { name: "Endgültig löschen" }).click();
    await page.getByLabel(/Zur Bestätigung den Firmennamen eintippen/).fill(NEUE_FIRMA_NAME);
    await screenshot(page, "loeschen_bestaetigung");
    // Nach dem Löschen lädt die Seite die Liste neu (eigener, nicht
    // abgewarteter Aufruf im Frontend) -- auf genau diese Antwort warten,
    // sonst prüft die nächste Zeile die noch alte Liste.
    const listeNachLoeschen = page.waitForResponse(
      (res) => res.url().includes("/api/superadmin/firmen") && res.request().method() === "GET"
    );
    await page
      .getByRole("dialog", { name: "Firma endgültig löschen" })
      .getByRole("button", { name: "Endgültig löschen" })
      .click();
    await listeNachLoeschen;
    await page.getByRole("dialog", { name: "Firma endgültig löschen" }).waitFor({ state: "detached" });
    const nochInDerListe = await page.getByRole("cell", { name: NEUE_FIRMA_NAME, exact: true }).count();
    if (nochInDerListe !== 0) {
      throw new Error("Firma steht nach dem Löschen noch in der Liste.");
    }
    log("Firma endgültig gelöscht");

    await abmelden(page);

    // 7) Login admin-a → Dashboard
    log("Login admin-a");
    await anmelden(page, "admin-a@werkstatt.test", "Werkstatt-Test-2026");
    await page.getByText(/Guten (Morgen|Tag|Abend)/).waitFor();
    await screenshot(page, "dashboard_admin_a");
    await abmelden(page);

    // 8) Login user-a → Dashboard
    log("Login user-a");
    await anmelden(page, "user-a@werkstatt.test", "Werkstatt-Test-2026");
    await page.getByText(/Guten (Morgen|Tag|Abend)/).waitFor();
    await screenshot(page, "dashboard_user_a");

    log("Klicktest erfolgreich.");
  } catch (err) {
    await screenshot(page, "fehler").catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

async function main() {
  fs.rmSync(screenshotDir, { recursive: true, force: true });
  fs.mkdirSync(screenshotDir, { recursive: true });

  await datenbankNeuAnlegen();

  log("Datenbank migrieren");
  laufenLassen(process.execPath, ["src/db/migrate.js"], backendDir);

  log("Werkstatt-Demodaten einspielen");
  laufenLassen(process.execPath, ["src/db/seed-werkstatt.js"], backendDir);

  log("Frontend bauen");
  laufenLassen("npm", ["run", "build"], frontendDir);

  log(`Backend auf Port ${PORT} starten`);
  const backend = backendStarten();
  try {
    await aufGesundheitWarten();
    await ablaufDurchfuehren();
  } finally {
    backend.kill();
  }
}

main().catch((err) => {
  console.error(`\nAbbruch: ${err.message}`);
  process.exitCode = 1;
});
