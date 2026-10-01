import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../pool.js";
import { withFirma } from "../withFirma.js";
import { erstelleTestfirma, loescheTestfirma, schliesseTestVerbindungen } from "./helpers.js";

const firmaA = await erstelleTestfirma("Test A");
const firmaB = await erstelleTestfirma("Test B");
const kontaktB = await withFirma(firmaB, async (client) => {
  const { rows } = await client.query(
    "INSERT INTO contacts (firma_id, nachname) VALUES ($1, 'Kontakt von Firma B') RETURNING id",
    [firmaB]
  );
  return rows[0].id;
});

after(async () => {
  await loescheTestfirma(firmaA);
  await loescheTestfirma(firmaB);
  await schliesseTestVerbindungen();
  await pool.end();
});

test("ohne gesetzte Firma sieht man keine Kontakte (sicher in der Grundeinstellung)", async () => {
  const { rows } = await pool.query("SELECT * FROM contacts WHERE id = $1", [kontaktB]);
  assert.equal(rows.length, 0);
});

test("SELECT: Firma A sieht den Kontakt von Firma B nicht", async () => {
  const rows = await withFirma(firmaA, (client) =>
    client.query("SELECT * FROM contacts WHERE id = $1", [kontaktB]).then((r) => r.rows)
  );
  assert.equal(rows.length, 0);
});

test("INSERT: Firma A kann keinen Kontakt für Firma B anlegen", async () => {
  await assert.rejects(
    withFirma(firmaA, (client) =>
      client.query("INSERT INTO contacts (firma_id, nachname) VALUES ($1, 'unerlaubt')", [firmaB])
    )
  );
});

test("UPDATE: Firma A kann den Kontakt von Firma B nicht ändern", async () => {
  const result = await withFirma(firmaA, (client) =>
    client.query("UPDATE contacts SET nachname = 'gehackt' WHERE id = $1", [kontaktB])
  );
  assert.equal(result.rowCount, 0);
});

test("DELETE: Firma A kann den Kontakt von Firma B nicht löschen", async () => {
  const result = await withFirma(firmaA, (client) =>
    client.query("DELETE FROM contacts WHERE id = $1", [kontaktB])
  );
  assert.equal(result.rowCount, 0);

  const rows = await withFirma(firmaB, (client) =>
    client.query("SELECT id FROM contacts WHERE id = $1", [kontaktB]).then((r) => r.rows)
  );
  assert.equal(rows.length, 1);
});

test("Querverweis: eine Notiz von Firma A darf nicht auf einen Kontakt von Firma B zeigen", async () => {
  await assert.rejects(
    withFirma(firmaA, (client) =>
      client.query(
        "INSERT INTO notes (firma_id, contact_id, text) VALUES ($1, $2, 'zeigt auf fremden Kontakt')",
        [firmaA, kontaktB]
      )
    )
  );
});
