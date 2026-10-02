import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(dirname, "../../index.js");

// Startet den echten Server-Prozess (nicht nur createApp()) -- der Abbruch
// bei Werkstatt + Produktivbetrieb passiert in index.js, bevor die
// Datenbank überhaupt gebraucht wird (Phase 3).
function starteProzess(env) {
  return new Promise((resolve) => {
    const proc = spawn("node", [indexPath], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("exit", (code) => resolve({ code, stderr }));

    // Falls der Prozess doch hochfährt (z. B. durch einen Fehler in der
    // Prüfung), nach kurzer Zeit abbrechen statt den Test hängen zu lassen.
    setTimeout(() => {
      if (!proc.killed) proc.kill();
    }, 2000);
  });
}

test("Backend bricht ab, wenn Werkstatt im Produktivbetrieb gestartet werden soll", async () => {
  const { code, stderr } = await starteProzess({ NODE_ENV: "production", APP_NAME: "werkstatt" });
  assert.equal(code, 1);
  assert.match(stderr, /Werkstatt/);
});
