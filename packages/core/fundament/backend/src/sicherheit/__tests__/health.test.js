import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { schliesseTestVerbindungen } from "../../db/__tests__/helpers.js";

// Der Health-Check muss bei einem Datenbankausfall ehrlich "fehler" melden.
// update.sh vertraut dem Feld "status" -- sonst gilt ein Update als gesund.

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Health-Check bei funktionierender Datenbank: status ok, HTTP 200", async () => {
  const res = await fetch(`${basis}/api/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body, { status: "ok", datenbank: "ok" });
});

test("Health-Check bei Datenbankausfall: HTTP 503 UND status fehler", async () => {
  const echt = pool.query;
  pool.query = async () => {
    throw new Error("Datenbank nicht erreichbar (Test)");
  };
  try {
    const res = await fetch(`${basis}/api/health`);
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.status, "fehler");
    assert.equal(body.datenbank, "fehler");
  } finally {
    pool.query = echt;
  }
});
