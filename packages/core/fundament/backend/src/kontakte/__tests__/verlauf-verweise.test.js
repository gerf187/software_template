import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { erstelleTestfirma, loescheTestfirma, schliesseTestVerbindungen } from "../../db/__tests__/helpers.js";
import { loeseVerweiseAuf, aenderungenAus } from "../verlauf.js";

// Felder, die auf einen anderen Datensatz zeigen, erscheinen im Verlauf mit dem Namen
// statt mit der Nummer. Ist der Datensatz weg: "(gelöscht)".

const firmaId = await erstelleTestfirma("Verlauf Verweise");
const andererFirmaId = await erstelleTestfirma("Verlauf Verweise fremd");

after(async () => {
  await loescheTestfirma(firmaId);
  await loescheTestfirma(andererFirmaId);
  await schliesseTestVerbindungen();
  await pool.end();
});

const felder = { zustaendig_id: "Zuständig" };
const verweise = { zustaendig_id: { tabelle: "users", spalte: "name" } };

test("Verweis-Feld zeigt den Namen, fehlender Datensatz zeigt '(gelöscht)'", async () => {
  const userId = await withFirma(firmaId, (client) =>
    client
      .query(
        "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, 'zust@example.test', 'x', 'Frau Zuständig', 'User') RETURNING id",
        [firmaId]
      )
      .then((r) => r.rows[0].id)
  );
  const geloeschteId = 987654;

  const roh = [
    aenderungenAus({ zustaendig_id: null }, { zustaendig_id: userId }, felder),
    aenderungenAus({ zustaendig_id: userId }, { zustaendig_id: geloeschteId }, felder),
  ];
  const aufbereitet = await withFirma(firmaId, (client) => loeseVerweiseAuf(client, firmaId, roh, verweise));

  assert.deepEqual(aufbereitet[0], [{ feld: "Zuständig", alt: "(leer)", neu: "Frau Zuständig" }]);
  assert.deepEqual(aufbereitet[1], [{ feld: "Zuständig", alt: "Frau Zuständig", neu: "(gelöscht)" }]);
});

test("Verweis auf einen Datensatz einer anderen Firma wird nicht aufgelöst", async () => {
  const fremderId = await withFirma(andererFirmaId, (client) =>
    client
      .query(
        "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, 'fremd@example.test', 'x', 'Fremd', 'User') RETURNING id",
        [andererFirmaId]
      )
      .then((r) => r.rows[0].id)
  );
  const roh = [aenderungenAus({ zustaendig_id: null }, { zustaendig_id: fremderId }, felder)];
  const aufbereitet = await withFirma(firmaId, (client) => loeseVerweiseAuf(client, firmaId, roh, verweise));
  assert.equal(aufbereitet[0][0].neu, "(gelöscht)");
});
