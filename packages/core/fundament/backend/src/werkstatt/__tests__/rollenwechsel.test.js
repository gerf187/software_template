import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import {
  werkstattDatenZuruecksetzen,
  werkstattDatenAnlegen,
} from "../../db/seed-werkstatt.js";

await werkstattDatenZuruecksetzen();
await werkstattDatenAnlegen();

const server = createApp({ appName: "werkstatt", production: false }).listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await werkstattDatenZuruecksetzen();
  await pool.end();
});

test("Rollenwechsel meldet als bekanntes Werkstatt-Test-Konto an", async () => {
  const res = await fetch(`${basis}/api/werkstatt/anmelden-als`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "betrachter-a@werkstatt.test" }),
  });
  assert.equal(res.status, 200);
  const daten = await res.json();
  assert.equal(daten.rolle, "Betrachter");
  assert.ok(res.headers.get("set-cookie")?.includes("session="));
});

test("Rollenwechsel lehnt unbekannte E-Mail ab", async () => {
  const res = await fetch(`${basis}/api/werkstatt/anmelden-als`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "jemand-anders@example.test" }),
  });
  assert.equal(res.status, 400);
});
