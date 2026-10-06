import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../pool.js";
import { schliesseTestVerbindungen } from "./helpers.js";

// "Empfohlen von" ist entfernt (Entscheidung Björn). Die Spalten und ihre
// Verweise dürfen in der Datenbank nicht mehr existieren.

after(async () => {
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Tabelle contacts hat keine Spalten mehr für 'Empfohlen von'", async () => {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name LIKE 'empfohlen%'`
  );
  assert.deepEqual(rows, []);
});
