import { test, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

// Schutzregel 3 aus Migration 0014: Der Helfer aenderungsprotokoll_aktivieren()
// lehnt Tabellen ohne Spalte "id" ab (z. B. rechte), weil der Trigger die
// Datensatz-Nummer braucht. Der Test läuft im Eigentümer-Zugang in einer
// Transaktion, die am Ende zurückgerollt wird -- es bleibt nichts zurück.

const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
const eigentuemer = new pg.Client({
  connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
});
await eigentuemer.connect();

after(async () => {
  await eigentuemer.end();
});

test("Tabelle ohne Spalte id (rechte) wird nicht an den Protokoll-Trigger angehängt", async () => {
  await eigentuemer.query("BEGIN");
  try {
    await assert.rejects(
      eigentuemer.query("SELECT aenderungsprotokoll_aktivieren('rechte')"),
      /keine Spalte "id"/
    );
  } finally {
    await eigentuemer.query("ROLLBACK");
  }
});

test("Tabelle mit Spalte id lässt sich anhängen und bekommt den Trigger", async () => {
  await eigentuemer.query("BEGIN");
  try {
    await eigentuemer.query("CREATE TABLE probe_mit_id (id INT PRIMARY KEY, firma_id INT)");
    await eigentuemer.query("SELECT aenderungsprotokoll_aktivieren('probe_mit_id')");
    const { rows } = await eigentuemer.query(
      "SELECT count(*)::int AS anzahl FROM pg_trigger WHERE tgname = 'aenderungsprotokoll' AND tgrelid = 'probe_mit_id'::regclass"
    );
    assert.equal(rows[0].anzahl, 1);
  } finally {
    await eigentuemer.query("ROLLBACK");
  }
});
