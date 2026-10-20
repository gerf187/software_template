// Sammelt alle Frontend-Tests ein: src/**/__tests__/*.test.js im Fundament
// plus frontend/__tests__/*.test.js jedes in app.config.js aktivierten
// Bausteins (Abschnitt 12: "Jeder Baustein bekommt zusätzlich automatische
// Tests"). Gleiches Prinzip wie test-runner.mjs im Backend.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function finde(ordner) {
  if (!fs.existsSync(ordner)) return [];
  return fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const pfad = path.join(ordner, e.name);
    if (e.isDirectory()) return finde(pfad);
    return e.name.endsWith(".test.js") && pfad.includes(`${path.sep}__tests__${path.sep}`) ? [pfad] : [];
  });
}

const dateien = finde(path.join(dirname, "src")).map((p) => path.relative(dirname, p));

const appName = process.env.VITE_APP || "werkstatt";
const appsRoot = path.resolve(dirname, "../../../../apps");
const gemeinsamerOrdner = path.resolve(dirname, "../../../modules");
const { default: appConfig } = await import(
  pathToFileURL(path.join(appsRoot, appName, "app.config.js")).href
);

for (const name of appConfig.module || []) {
  const inApp = path.join(appsRoot, appName, "modules", name);
  const gemeinsam = path.join(gemeinsamerOrdner, name);
  const basis = fs.existsSync(path.join(inApp, "modul.config.js")) ? inApp : gemeinsam;
  const modulTests = finde(path.join(basis, "frontend/__tests__")).map((p) =>
    path.relative(dirname, p)
  );
  dateien.push(...modulTests);
}

const tests = spawnSync(process.execPath, ["--test", ...dateien], { stdio: "inherit" });
process.exit(tests.status ?? 1);
