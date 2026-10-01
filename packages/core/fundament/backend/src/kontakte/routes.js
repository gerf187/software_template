import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { erfordertRecht } from "../rechte/darf.js";
import { withFirma } from "../db/withFirma.js";

const router = Router();

const KONTAKT_SPALTEN = `
  id, anrede, vorname, nachname, organisation, email, telefon, mobil,
  wohnadresse_strasse, wohnadresse_plz, wohnadresse_ort,
  empfohlen_von_kontakt_id, empfohlen_von_text, erstellt_am
`;

function kontaktFelder(body) {
  return {
    anrede: body.anrede || null,
    vorname: body.vorname || null,
    nachname: (body.nachname || "").trim(),
    organisation: body.organisation || null,
    email: body.email || null,
    telefon: body.telefon || null,
    mobil: body.mobil || null,
    wohnadresse_strasse: body.wohnadresseStrasse || null,
    wohnadresse_plz: body.wohnadressePlz || null,
    wohnadresse_ort: body.wohnadresseOrt || null,
    empfohlen_von_kontakt_id: body.empfohlenVonKontaktId || null,
    empfohlen_von_text: body.empfohlenVonKontaktId ? null : body.empfohlenVonText || null,
  };
}

router.use(requireAuth);

router.get("/", erfordertRecht("kontakte", "sehen"), async (req, res) => {
  const suche = (req.query.q || "").trim();
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT ${KONTAKT_SPALTEN} FROM contacts
         WHERE deleted_at IS NULL
           AND ($1 = '' OR
                nachname ILIKE '%' || $1 || '%' OR
                vorname ILIKE '%' || $1 || '%' OR
                organisation ILIKE '%' || $1 || '%' OR
                email ILIKE '%' || $1 || '%')
         ORDER BY nachname, vorname`,
        [suche]
      )
      .then((r) => r.rows)
  );
  res.json(rows);
});

router.get("/:id", erfordertRecht("kontakte", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(`SELECT ${KONTAKT_SPALTEN} FROM contacts WHERE id = $1 AND deleted_at IS NULL`, [
        req.params.id,
      ])
      .then((r) => r.rows)
  );
  if (!rows[0]) return res.status(404).json({ error: "Kontakt nicht gefunden." });
  res.json(rows[0]);
});

router.post("/", erfordertRecht("kontakte", "bearbeiten"), async (req, res) => {
  const felder = kontaktFelder(req.body || {});
  if (!felder.nachname) {
    return res.status(400).json({ error: "Bitte einen Nachnamen angeben." });
  }

  try {
    const rows = await withFirma(
      req.user.firmaId,
      (client) =>
        client
          .query(
            `INSERT INTO contacts (
               firma_id, anrede, vorname, nachname, organisation, email, telefon, mobil,
               wohnadresse_strasse, wohnadresse_plz, wohnadresse_ort,
               empfohlen_von_kontakt_id, empfohlen_von_text
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING ${KONTAKT_SPALTEN}`,
            [
              req.user.firmaId,
              felder.anrede,
              felder.vorname,
              felder.nachname,
              felder.organisation,
              felder.email,
              felder.telefon,
              felder.mobil,
              felder.wohnadresse_strasse,
              felder.wohnadresse_plz,
              felder.wohnadresse_ort,
              felder.empfohlen_von_kontakt_id,
              felder.empfohlen_von_text,
            ]
          )
          .then((r) => r.rows),
      { userId: req.user.id }
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: "Kontakt konnte nicht angelegt werden." });
  }
});

router.put("/:id", erfordertRecht("kontakte", "bearbeiten"), async (req, res) => {
  const felder = kontaktFelder(req.body || {});
  if (!felder.nachname) {
    return res.status(400).json({ error: "Bitte einen Nachnamen angeben." });
  }

  try {
    const rows = await withFirma(
      req.user.firmaId,
      (client) =>
        client
          .query(
            `UPDATE contacts SET
               anrede = $2, vorname = $3, nachname = $4, organisation = $5, email = $6,
               telefon = $7, mobil = $8,
               wohnadresse_strasse = $9, wohnadresse_plz = $10, wohnadresse_ort = $11,
               empfohlen_von_kontakt_id = $12, empfohlen_von_text = $13
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING ${KONTAKT_SPALTEN}`,
            [
              req.params.id,
              felder.anrede,
              felder.vorname,
              felder.nachname,
              felder.organisation,
              felder.email,
              felder.telefon,
              felder.mobil,
              felder.wohnadresse_strasse,
              felder.wohnadresse_plz,
              felder.wohnadresse_ort,
              felder.empfohlen_von_kontakt_id,
              felder.empfohlen_von_text,
            ]
          )
          .then((r) => r.rows),
      { userId: req.user.id }
    );
    if (!rows[0]) return res.status(404).json({ error: "Kontakt nicht gefunden." });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: "Kontakt konnte nicht gespeichert werden." });
  }
});

router.delete("/:id", erfordertRecht("kontakte", "loeschen"), async (req, res) => {
  const rows = await withFirma(
    req.user.firmaId,
    (client) =>
      client
        .query(
          `UPDATE contacts SET deleted_at = now()
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING id`,
          [req.params.id]
        )
        .then((r) => r.rows),
    { userId: req.user.id }
  );
  if (!rows[0]) return res.status(404).json({ error: "Kontakt nicht gefunden." });
  res.json({ status: "ok" });
});

// Notizen (Tab "Notizen").
router.get("/:id/notizen", erfordertRecht("kontakte", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT id, text, erstellt_von, erstellt_am FROM notes
         WHERE contact_id = $1 AND deleted_at IS NULL ORDER BY erstellt_am DESC`,
        [req.params.id]
      )
      .then((r) => r.rows)
  );
  res.json(rows);
});

router.post("/:id/notizen", erfordertRecht("kontakte", "bearbeiten"), async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Bitte einen Text angeben." });

  const rows = await withFirma(
    req.user.firmaId,
    (client) =>
      client
        .query(
          `INSERT INTO notes (firma_id, contact_id, text, erstellt_von)
           VALUES ($1, $2, $3, $4)
           RETURNING id, text, erstellt_von, erstellt_am`,
          [req.user.firmaId, req.params.id, text, req.user.id]
        )
        .then((r) => r.rows),
    { userId: req.user.id }
  );
  res.status(201).json(rows[0]);
});

// Aufgaben (Tab "Aufgaben"): Freitext + Fälligkeit + erledigt.
router.get("/:id/aufgaben", erfordertRecht("kontakte", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT id, text, faellig_am, status, erstellt_am FROM tasks
         WHERE contact_id = $1 AND deleted_at IS NULL ORDER BY faellig_am NULLS LAST, erstellt_am`,
        [req.params.id]
      )
      .then((r) => r.rows)
  );
  res.json(rows);
});

router.post("/:id/aufgaben", erfordertRecht("kontakte", "bearbeiten"), async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Bitte einen Text angeben." });

  const rows = await withFirma(
    req.user.firmaId,
    (client) =>
      client
        .query(
          `INSERT INTO tasks (firma_id, contact_id, text, faellig_am, status)
           VALUES ($1, $2, $3, $4, 'offen')
           RETURNING id, text, faellig_am, status, erstellt_am`,
          [req.user.firmaId, req.params.id, text, req.body?.faelligAm || null]
        )
        .then((r) => r.rows),
    { userId: req.user.id }
  );
  res.status(201).json(rows[0]);
});

router.patch(
  "/:id/aufgaben/:aufgabeId",
  erfordertRecht("kontakte", "bearbeiten"),
  async (req, res) => {
    const status = req.body?.erledigt ? "erledigt" : "offen";
    const rows = await withFirma(
      req.user.firmaId,
      (client) =>
        client
          .query(
            `UPDATE tasks SET status = $3
             WHERE id = $1 AND contact_id = $2 AND deleted_at IS NULL
             RETURNING id, text, faellig_am, status, erstellt_am`,
            [req.params.aufgabeId, req.params.id, status]
          )
          .then((r) => r.rows),
      { userId: req.user.id }
    );
    if (!rows[0]) return res.status(404).json({ error: "Aufgabe nicht gefunden." });
    res.json(rows[0]);
  }
);

// Verlauf (Tab "Verlauf"): lesbar formulierte Einträge aus dem
// Änderungsprotokoll (Abschnitt 6), nur für diesen Kontakt.
router.get("/:id/verlauf", erfordertRecht("kontakte", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT ap.id, ap.zeitpunkt, ap.aktion, ap.alte_werte, ap.neue_werte, u.name AS benutzer_name
         FROM aenderungsprotokoll ap
         LEFT JOIN users u ON u.id = ap.user_id
         WHERE ap.tabelle = 'contacts' AND ap.datensatz_id = $1
         ORDER BY ap.zeitpunkt DESC`,
        [req.params.id]
      )
      .then((r) => r.rows)
  );
  res.json(rows);
});

// Datenexport pro Kontakt (DSGVO-Auskunftsrecht, Abschnitt 6).
router.get("/:id/export", erfordertRecht("kontakte", "sehen"), async (req, res) => {
  const daten = await withFirma(req.user.firmaId, async (client) => {
    const kontakt = await client.query(
      `SELECT ${KONTAKT_SPALTEN} FROM contacts WHERE id = $1`,
      [req.params.id]
    );
    if (!kontakt.rows[0]) return null;

    const notizen = await client.query(
      "SELECT text, erstellt_am FROM notes WHERE contact_id = $1 AND deleted_at IS NULL ORDER BY erstellt_am",
      [req.params.id]
    );
    const aufgaben = await client.query(
      "SELECT text, faellig_am, status, erstellt_am FROM tasks WHERE contact_id = $1 AND deleted_at IS NULL ORDER BY erstellt_am",
      [req.params.id]
    );

    return { kontakt: kontakt.rows[0], notizen: notizen.rows, aufgaben: aufgaben.rows };
  });

  if (!daten) return res.status(404).json({ error: "Kontakt nicht gefunden." });

  res.setHeader("Content-Disposition", `attachment; filename="kontakt-${req.params.id}.json"`);
  res.json(daten);
});

export default router;
