import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../pool.js";
import { withFirma } from "../withFirma.js";
import { hashPassword } from "../../auth/password.js";
import { erstelleTestfirma, loescheTestfirma, schliesseTestVerbindungen } from "./helpers.js";

const firmaA = await erstelleTestfirma("Protokoll Test A");
const firmaB = await erstelleTestfirma("Protokoll Test B");

const benutzerA = await withFirma(firmaA, async (client) => {
  const hash = await hashPassword("Ein-Sicheres-Passwort-12");
  const { rows } = await client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Protokoll Tester', 'Mitarbeiter') RETURNING id",
    [firmaA, `protokoll-${firmaA}@example.test`, hash]
  );
  return rows[0].id;
});

after(async () => {
  await loescheTestfirma(firmaA);
  await loescheTestfirma(firmaB);
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Anlegen eines Kontakts erzeugt einen Protokoll-Eintrag 'angelegt'", async () => {
  const kontaktId = await withFirma(
    firmaA,
    async (client) => {
      const { rows } = await client.query(
        "INSERT INTO contacts (firma_id, name) VALUES ($1, 'Protokoll Kontakt') RETURNING id",
        [firmaA]
      );
      return rows[0].id;
    },
    { userId: benutzerA }
  );

  const rows = await withFirma(firmaA, (client) =>
    client
      .query(
        "SELECT * FROM aenderungsprotokoll WHERE tabelle = 'contacts' AND datensatz_id = $1",
        [kontaktId]
      )
      .then((r) => r.rows)
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].aktion, "angelegt");
  assert.equal(rows[0].user_id, benutzerA);
  assert.equal(rows[0].alte_werte, null);
  assert.equal(rows[0].neue_werte.name, "Protokoll Kontakt");
});

test("Ändern eines Kontakts erzeugt einen Protokoll-Eintrag 'geaendert'", async () => {
  const kontaktId = await withFirma(
    firmaA,
    async (client) => {
      const { rows } = await client.query(
        "INSERT INTO contacts (firma_id, name) VALUES ($1, 'Vor der Änderung') RETURNING id",
        [firmaA]
      );
      await client.query("UPDATE contacts SET name = 'Nach der Änderung' WHERE id = $1", [
        rows[0].id,
      ]);
      return rows[0].id;
    },
    { userId: benutzerA }
  );

  const rows = await withFirma(firmaA, (client) =>
    client
      .query(
        "SELECT * FROM aenderungsprotokoll WHERE tabelle = 'contacts' AND datensatz_id = $1 AND aktion = 'geaendert'",
        [kontaktId]
      )
      .then((r) => r.rows)
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].alte_werte.name, "Vor der Änderung");
  assert.equal(rows[0].neue_werte.name, "Nach der Änderung");
});

test("Löschen (Soft-Delete) eines Kontakts erzeugt einen Protokoll-Eintrag 'geloescht'", async () => {
  const kontaktId = await withFirma(
    firmaA,
    async (client) => {
      const { rows } = await client.query(
        "INSERT INTO contacts (firma_id, name) VALUES ($1, 'Wird gelöscht') RETURNING id",
        [firmaA]
      );
      await client.query("UPDATE contacts SET deleted_at = now() WHERE id = $1", [rows[0].id]);
      return rows[0].id;
    },
    { userId: benutzerA }
  );

  const rows = await withFirma(firmaA, (client) =>
    client
      .query(
        "SELECT * FROM aenderungsprotokoll WHERE tabelle = 'contacts' AND datensatz_id = $1 AND aktion = 'geloescht'",
        [kontaktId]
      )
      .then((r) => r.rows)
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].alte_werte.deleted_at, null);
  assert.ok(rows[0].neue_werte.deleted_at);
});

test("Firma B sieht keine Protokoll-Einträge von Firma A", async () => {
  const kontaktId = await withFirma(firmaA, async (client) => {
    const { rows } = await client.query(
      "INSERT INTO contacts (firma_id, name) VALUES ($1, 'Nur für Firma A') RETURNING id",
      [firmaA]
    );
    return rows[0].id;
  });

  const rows = await withFirma(firmaB, (client) =>
    client
      .query("SELECT * FROM aenderungsprotokoll WHERE tabelle = 'contacts' AND datensatz_id = $1", [
        kontaktId,
      ])
      .then((r) => r.rows)
  );

  assert.equal(rows.length, 0);
});

test("Protokoll-Einträge lassen sich nicht ändern", async () => {
  const protokollId = await withFirma(firmaA, async (client) => {
    const kontakt = await client.query(
      "INSERT INTO contacts (firma_id, name) VALUES ($1, 'Unveränderlich') RETURNING id",
      [firmaA]
    );
    const { rows } = await client.query(
      "SELECT id FROM aenderungsprotokoll WHERE tabelle = 'contacts' AND datensatz_id = $1",
      [kontakt.rows[0].id]
    );
    return rows[0].id;
  });

  await assert.rejects(
    withFirma(firmaA, (client) =>
      client.query("UPDATE aenderungsprotokoll SET aktion = 'angelegt' WHERE id = $1", [
        protokollId,
      ])
    )
  );
});

test("Protokoll-Einträge lassen sich nicht löschen", async () => {
  const protokollId = await withFirma(firmaA, async (client) => {
    const kontakt = await client.query(
      "INSERT INTO contacts (firma_id, name) VALUES ($1, 'Auch unlöschbar') RETURNING id",
      [firmaA]
    );
    const { rows } = await client.query(
      "SELECT id FROM aenderungsprotokoll WHERE tabelle = 'contacts' AND datensatz_id = $1",
      [kontakt.rows[0].id]
    );
    return rows[0].id;
  });

  await assert.rejects(
    withFirma(firmaA, (client) =>
      client.query("DELETE FROM aenderungsprotokoll WHERE id = $1", [protokollId])
    )
  );
});
