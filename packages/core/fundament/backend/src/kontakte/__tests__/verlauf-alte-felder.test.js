import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { hashPassword } from "../../auth/password.js";
import {
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

// Alte Protokoll-Einträge mit Feldern, die es nicht mehr gibt (z. B. "Empfohlen von"),
// erscheinen im Verlauf nicht. Das Protokoll selbst bleibt unverändert.

const PASSWORT = "Alte-Felder-Passwort-Zeile-21";
const firmaId = await erstelleTestfirmaMitRechten("Verlauf alte Felder");
const email = `alte-felder-${firmaId}@example.test`;
await withFirma(firmaId, async (client) => {
  const hash = await hashPassword(PASSWORT);
  await client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Admin', 'Admin')",
    [firmaId, email, hash]
  );
});

const server = createApp({ appName: "energieberater", production: false }).listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestfirma(firmaId);
  await schliesseTestVerbindungen();
  await pool.end();
});

function api(method, pfad, { cookie, body } = {}) {
  return fetch(`${basis}${pfad}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: basis, ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("Verlauf blendet Änderungen an entfernten Feldern aus, das Protokoll bleibt", async () => {
  const anmeldung = await api("POST", "/api/auth/login", { body: { email, passwort: PASSWORT } });
  const cookie = anmeldung.headers.get("set-cookie")?.split(";")[0];
  const { id } = await (await api("POST", "/api/kontakte", { cookie, body: { nachname: "Alt" } })).json();

  // Alter Protokoll-Eintrag mit dem entfernten Feld, direkt im Protokoll angelegt.
  await withFirma(firmaId, (client) =>
    client.query(
      `INSERT INTO aenderungsprotokoll (firma_id, tabelle, datensatz_id, aktion, alte_werte, neue_werte)
       VALUES ($1, 'contacts', $2, 'geaendert', '{"empfohlen_von_text":null}', '{"empfohlen_von_text":"Google"}')`,
      [firmaId, id]
    )
  );

  const eintraege = await (await api("GET", `/api/kontakte/${id}/verlauf`, { cookie })).json();
  assert.equal(
    eintraege.some((e) => e.aktion === "geaendert" && e.aenderungen.length === 0),
    false,
    "Eintrag ohne anzeigbare Änderung darf nicht erscheinen"
  );
  const roh = await withFirma(firmaId, (client) =>
    client
      .query("SELECT count(*)::int AS n FROM aenderungsprotokoll WHERE tabelle = 'contacts' AND datensatz_id = $1 AND aktion = 'geaendert'", [id])
      .then((r) => r.rows[0].n)
  );
  assert.equal(roh, 1, "Protokoll-Eintrag bleibt in der Datenbank");
});
