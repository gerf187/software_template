import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { schliesseTestVerbindungen } from "../../db/__tests__/helpers.js";

// Eigene Datei, damit die Anfragen hier nicht das Limit der anderen Tests
// verbrauchen (jede Testdatei läuft in einem eigenen Prozess).
const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Rate-Begrenzung: 300 Anfragen pro Minute gehen durch, die 301. wird mit 429 abgewiesen", async () => {
  // /api/auth/me ohne Anmeldung liefert 401 -- zählt aber für das Limit.
  for (let i = 1; i <= 300; i++) {
    const res = await fetch(`${basis}/api/auth/me`);
    assert.notEqual(res.status, 429, `Anfrage ${i} wurde zu früh blockiert`);
  }

  const res = await fetch(`${basis}/api/auth/me`);
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.error, "Zu viele Anfragen, bitte kurz warten.");
});

test("Rate-Begrenzung: /api/health bleibt auch nach dem Limit erreichbar", async () => {
  const res = await fetch(`${basis}/api/health`);
  assert.notEqual(res.status, 429);
});
