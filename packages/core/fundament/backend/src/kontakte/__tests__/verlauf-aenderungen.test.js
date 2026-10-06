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

// Verlauf zeigt bei "geändert" WAS sich geändert hat: nur geänderte Felder, mit
// lesbarem Namen, ohne technische Felder (id, firma_id, Zeitstempel).

const PASSWORT = "Verlauf-Passwort-Zeile-55";
const firmaId = await erstelleTestfirmaMitRechten("Verlauf Aenderungen");
const email = `verlauf-${firmaId}@example.test`;
await withFirma(firmaId, async (client) => {
  const hash = await hashPassword(PASSWORT);
  await client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Verlauf Admin', 'Admin')",
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

test("Verlauf nennt bei einer Änderung nur das geänderte Feld mit altem und neuem Wert", async () => {
  const anmeldung = await api("POST", "/api/auth/login", { body: { email, passwort: PASSWORT } });
  const cookie = anmeldung.headers.get("set-cookie")?.split(";")[0];

  const anlegen = await api("POST", "/api/kontakte", {
    cookie,
    body: { vorname: "Ann", nachname: "Verlauf", telefon: "0221 111111" },
  });
  const { id } = await anlegen.json();

  await api("PUT", `/api/kontakte/${id}`, {
    cookie,
    body: { vorname: "Ann", nachname: "Verlauf", telefon: "0221 222222" },
  });

  const res = await api("GET", `/api/kontakte/${id}/verlauf`, { cookie });
  assert.equal(res.status, 200);
  const eintraege = await res.json();
  const geaendert = eintraege.find((e) => e.aktion === "geaendert");
  assert.ok(geaendert, "Änderungs-Eintrag fehlt");
  assert.deepEqual(geaendert.aenderungen, [
    { feld: "Telefon", alt: "0221 111111", neu: "0221 222222" },
  ]);
  // Technische Werte gehören nicht in die Anzeige
  assert.equal("alte_werte" in geaendert, false);
  assert.equal("neue_werte" in geaendert, false);
});
