import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../pool.js";
import { schliesseTestVerbindungen } from "./helpers.js";

// Wird die Datenbank neu gestartet, beendet sie die Verbindungen des Pools.
// Der Pool meldet das als "error"-Ereignis. Ohne Empfänger beendet Node den
// ganzen Prozess (beim Test am echten Stack: App stürzt bei DB-Neustart ab).

after(async () => {
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Unterbrochene Datenbank-Verbindung im Leerlauf beendet den Prozess nicht", () => {
  assert.doesNotThrow(() => pool.emit("error", new Error("terminating connection due to administrator command")));
});
