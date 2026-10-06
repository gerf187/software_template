import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { erstelleTestfirma, loescheTestfirma, schliesseTestVerbindungen } from "../../db/__tests__/helpers.js";

// Baustein ein/aus (firma_module) gehört ins Änderungsprotokoll (Abschnitt 6).
// Die Tabelle hat dafür eine eigene id-Spalte (Migration 0017).

const firmaId = await erstelleTestfirma("Protokoll Module");

after(async () => {
  await loescheTestfirma(firmaId);
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Baustein einschalten und ausschalten erzeugt Protokoll-Einträge", async () => {
  await withFirma(firmaId, (client) =>
    client.query("INSERT INTO firma_module (firma_id, modul, aktiv) VALUES ($1, 'beispiel', true)", [firmaId])
  );
  await withFirma(firmaId, (client) =>
    client.query("UPDATE firma_module SET aktiv = false WHERE firma_id = $1 AND modul = 'beispiel'", [firmaId])
  );

  const rows = await withFirma(firmaId, (client) =>
    client
      .query(
        "SELECT aktion, alte_werte, neue_werte FROM aenderungsprotokoll WHERE tabelle = 'firma_module' ORDER BY id"
      )
      .then((r) => r.rows)
  );
  assert.deepEqual(rows.map((r) => r.aktion), ["angelegt", "geaendert"]);
  assert.equal(rows[1].alte_werte.aktiv, true);
  assert.equal(rows[1].neue_werte.aktiv, false);
});
