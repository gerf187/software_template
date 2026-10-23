import { Router } from "express";
import { erfordertRecht, darf } from "@fundament/backend/src/rechte/darf.js";
import { withFirma } from "@fundament/backend/src/db/withFirma.js";
import { pruefeIdsAusUrl, istFremdschluesselFehler } from "@fundament/backend/src/db/ids.js";
import appConfig from "@fundament/backend/src/appConfig.js";
import { projektFelder, pruefeProjektFelder, pruefePhase } from "./validierung.js";
import { aenderungenAus } from "./verlauf.js";

const router = Router();
pruefeIdsAusUrl(router, ["id", "kontaktId", "aufgabeId"]);

const PROJEKT_SPALTEN = `
  p.id, p.contact_id, p.name, p.arten, p.status, p.phase,
  p.objektadresse_strasse, p.objektadresse_plz, p.objektadresse_ort,
  p.auftragsdatum, p.ablage_link, p.pausiert_grund, p.erstellt_am
`;

function kontaktName(k) {
  return [k.vorname, k.nachname].filter(Boolean).join(" ") || k.organisation || "(ohne Namen)";
}

router.use((req, res, next) => {
  req.projekteConfig = appConfig.projekte || {};
  next();
});

// Liste (Menüpunkt "Projekte"): Suche ohne Button, Filter nach Status,
// Projektart, Phase (Teil 1, Punkt 5). "Nur aktive" als Vorgabe entscheidet
// das Frontend anhand der konfigurierten Status-Liste (terminal: true).
router.get("/", erfordertRecht("projekte", "sehen"), async (req, res) => {
  const suche = (req.query.q || "").trim();
  const { status, art, phase } = req.query;

  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT ${PROJEKT_SPALTEN}, c.vorname AS kontakt_vorname, c.nachname AS kontakt_nachname,
                c.organisation AS kontakt_organisation
         FROM projects p
         JOIN contacts c ON c.id = p.contact_id
         WHERE p.deleted_at IS NULL
           AND ($1 = '' OR p.name ILIKE '%' || $1 || '%'
                OR p.objektadresse_ort ILIKE '%' || $1 || '%'
                OR p.objektadresse_strasse ILIKE '%' || $1 || '%')
           AND ($2::text IS NULL OR p.status = $2)
           AND ($3::text IS NULL OR $3 = ANY(p.arten))
           AND ($4::text IS NULL OR p.phase = $4)
         ORDER BY p.erstellt_am DESC`,
        [suche, status || null, art || null, phase || null]
      )
      .then((r) => r.rows)
  );

  res.json(
    rows.map((p) => ({
      id: p.id,
      contactId: p.contact_id,
      kontaktName: kontaktName({
        vorname: p.kontakt_vorname,
        nachname: p.kontakt_nachname,
        organisation: p.kontakt_organisation,
      }),
      name: p.name,
      arten: p.arten,
      status: p.status,
      phase: p.phase,
      auftragsdatum: p.auftragsdatum,
    }))
  );
});

// Projekte eines Kontakts (Tab "Projekte" auf der Kontakt-Akte, Teil 1, Punkt 7).
router.get("/kontakte/:kontaktId", erfordertRecht("projekte", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT ${PROJEKT_SPALTEN} FROM projects p
         WHERE p.contact_id = $1 AND p.deleted_at IS NULL
         ORDER BY p.erstellt_am DESC`,
        [req.params.kontaktId]
      )
      .then((r) => r.rows)
  );
  res.json(rows.map(projektAntwort));
});

router.get("/:id", erfordertRecht("projekte", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(`SELECT ${PROJEKT_SPALTEN} FROM projects p WHERE p.id = $1 AND p.deleted_at IS NULL`, [
        req.params.id,
      ])
      .then((r) => r.rows)
  );
  if (!rows[0]) return res.status(404).json({ error: "Projekt nicht gefunden." });
  res.json(projektAntwort(rows[0]));
});

router.post("/", erfordertRecht("projekte", "bearbeiten"), async (req, res) => {
  const contactId = Number(req.body?.contactId);
  if (!contactId) return res.status(400).json({ error: "Bitte einen Kontakt angeben." });

  const felder = projektFelder(req.body || {});
  const fehler = pruefeProjektFelder(felder, req.projekteConfig);
  if (fehler) return res.status(400).json({ error: fehler });

  try {
    const rows = await withFirma(
      req.user.firmaId,
      (client) =>
        client
          .query(
            `INSERT INTO projects AS p (
               firma_id, contact_id, name, arten, status, phase,
               objektadresse_strasse, objektadresse_plz, objektadresse_ort,
               auftragsdatum, ablage_link, pausiert_grund
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING ${PROJEKT_SPALTEN}`,
            [
              req.user.firmaId,
              contactId,
              felder.name,
              felder.arten,
              felder.status,
              felder.phase,
              felder.objektadresse_strasse,
              felder.objektadresse_plz,
              felder.objektadresse_ort,
              felder.auftragsdatum,
              felder.ablage_link,
              felder.pausiert_grund,
            ]
          )
          .then((r) => r.rows),
      { userId: req.user.id }
    );
    res.status(201).json(projektAntwort(rows[0]));
  } catch (err) {
    // Fremder oder unbekannter Kontakt: der zusammengesetzte Fremdschlüssel
    // (firma_id, contact_id) schlägt fehl (Abschnitt 6, Mandanten-Trennung).
    if (istFremdschluesselFehler(err)) {
      return res.status(404).json({ error: "Kontakt nicht gefunden." });
    }
    throw err;
  }
});

router.put("/:id", erfordertRecht("projekte", "bearbeiten"), async (req, res) => {
  const felder = projektFelder(req.body || {});
  const fehler = pruefeProjektFelder(felder, req.projekteConfig);
  if (fehler) return res.status(400).json({ error: fehler });

  const rows = await withFirma(
    req.user.firmaId,
    (client) =>
      client
        .query(
          `UPDATE projects AS p SET
             name = $2, arten = $3, status = $4, phase = $5,
             objektadresse_strasse = $6, objektadresse_plz = $7, objektadresse_ort = $8,
             auftragsdatum = $9, ablage_link = $10, pausiert_grund = $11
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING ${PROJEKT_SPALTEN}`,
          [
            req.params.id,
            felder.name,
            felder.arten,
            felder.status,
            felder.phase,
            felder.objektadresse_strasse,
            felder.objektadresse_plz,
            felder.objektadresse_ort,
            felder.auftragsdatum,
            felder.ablage_link,
            felder.pausiert_grund,
          ]
        )
        .then((r) => r.rows),
    { userId: req.user.id }
  );
  if (!rows[0]) return res.status(404).json({ error: "Projekt nicht gefunden." });
  res.json(projektAntwort(rows[0]));
});

// Phase per Klick vor/zurück setzen (Phasen-Leiste, Teil 1, Punkt 6) -- eigene,
// schlanke Route statt des ganzen Formulars.
router.patch("/:id/phase", erfordertRecht("projekte", "bearbeiten"), async (req, res) => {
  const phase = req.body?.phase || "";
  const fehler = pruefePhase(phase, req.projekteConfig);
  if (fehler) return res.status(400).json({ error: fehler });

  const rows = await withFirma(
    req.user.firmaId,
    (client) =>
      client
        .query(
          `UPDATE projects AS p SET phase = $2 WHERE id = $1 AND deleted_at IS NULL
           RETURNING ${PROJEKT_SPALTEN}`,
          [req.params.id, phase]
        )
        .then((r) => r.rows),
    { userId: req.user.id }
  );
  if (!rows[0]) return res.status(404).json({ error: "Projekt nicht gefunden." });
  res.json(projektAntwort(rows[0]));
});

router.delete("/:id", erfordertRecht("projekte", "loeschen"), async (req, res) => {
  const rows = await withFirma(
    req.user.firmaId,
    (client) =>
      client
        .query(
          `UPDATE projects SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
          [req.params.id]
        )
        .then((r) => r.rows),
    { userId: req.user.id }
  );
  if (!rows[0]) return res.status(404).json({ error: "Projekt nicht gefunden." });
  res.json({ status: "ok" });
});

// Notizen (Tab "Notizen" der Projekt-Akte, Teil 1, Punkt 6). notes/tasks
// gehören dem Fundament -- contact_id kommt per Unterabfrage aus dem Projekt
// selbst, nie aus der Anfrage (Abschnitt 6, Regel 3). Keine Treffer-Zeile
// beim INSERT heißt: Projekt nicht gefunden (404), ohne zweite Abfrage.
router.get("/:id/notizen", erfordertRecht("projekte", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT id, text, erstellt_von, erstellt_am FROM notes
         WHERE project_id = $1 AND deleted_at IS NULL ORDER BY erstellt_am DESC`,
        [req.params.id]
      )
      .then((r) => r.rows)
  );
  res.json(rows);
});

router.post("/:id/notizen", erfordertRecht("projekte", "bearbeiten"), async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Bitte einen Text angeben." });

  const rows = await withFirma(
    req.user.firmaId,
    (client) =>
      client
        .query(
          `INSERT INTO notes (firma_id, contact_id, project_id, text, erstellt_von)
           SELECT $1, p.contact_id, p.id, $3, $4 FROM projects p
           WHERE p.id = $2 AND p.deleted_at IS NULL
           RETURNING id, text, erstellt_von, erstellt_am`,
          [req.user.firmaId, req.params.id, text, req.user.id]
        )
        .then((r) => r.rows),
    { userId: req.user.id }
  );
  if (!rows[0]) return res.status(404).json({ error: "Projekt nicht gefunden." });
  res.status(201).json(rows[0]);
});

// Aufgaben (Tab "Aufgaben" der Projekt-Akte): Freitext + Fälligkeit + erledigt.
router.get("/:id/aufgaben", erfordertRecht("projekte", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT id, text, faellig_am, status, erstellt_am FROM tasks
         WHERE project_id = $1 AND deleted_at IS NULL ORDER BY faellig_am NULLS LAST, erstellt_am`,
        [req.params.id]
      )
      .then((r) => r.rows)
  );
  res.json(rows);
});

router.post("/:id/aufgaben", erfordertRecht("projekte", "bearbeiten"), async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Bitte einen Text angeben." });

  const rows = await withFirma(
    req.user.firmaId,
    (client) =>
      client
        .query(
          `INSERT INTO tasks (firma_id, contact_id, project_id, text, faellig_am, status)
           SELECT $1, p.contact_id, p.id, $3, $4, 'offen' FROM projects p
           WHERE p.id = $2 AND p.deleted_at IS NULL
           RETURNING id, text, faellig_am, status, erstellt_am`,
          [req.user.firmaId, req.params.id, text, req.body?.faelligAm || null]
        )
        .then((r) => r.rows),
    { userId: req.user.id }
  );
  if (!rows[0]) return res.status(404).json({ error: "Projekt nicht gefunden." });
  res.status(201).json(rows[0]);
});

router.patch(
  "/:id/aufgaben/:aufgabeId",
  erfordertRecht("projekte", "bearbeiten"),
  async (req, res) => {
    const status = req.body?.erledigt ? "erledigt" : "offen";
    const rows = await withFirma(
      req.user.firmaId,
      (client) =>
        client
          .query(
            `UPDATE tasks SET status = $3
             WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL
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

// Verlauf (Tab "Verlauf", nur Admin -- eigenes Recht "protokoll" wie bei
// Kontakten, Abschnitt 7: Änderungsprotokoll ist Admin-only, unabhängig vom
// Projekte-Recht).
router.get("/:id/verlauf", erfordertRecht("protokoll", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT ap.id, ap.zeitpunkt, ap.aktion, ap.alte_werte, ap.neue_werte, u.name AS benutzer_name
         FROM aenderungsprotokoll ap
         LEFT JOIN users u ON u.id = ap.user_id
         WHERE ap.tabelle = 'projects' AND ap.datensatz_id = $1
         ORDER BY ap.zeitpunkt DESC`,
        [req.params.id]
      )
      .then((r) => r.rows)
  );
  const eintraege = rows
    .map(({ alte_werte, neue_werte, ...eintrag }) => ({
      ...eintrag,
      aenderungen: eintrag.aktion === "geaendert" ? aenderungenAus(alte_werte, neue_werte) : [],
    }))
    .filter((e) => e.aktion !== "geaendert" || e.aenderungen.length > 0);
  res.json(eintraege);
});

// Kachel "Projekte" (Teil C, Punkt C3): 5 zuletzt bearbeitete, mit Kontakt,
// Phase und Status für die Anzeige.
router.get("/kacheln/zuletzt-bearbeitet", erfordertRecht("projekte", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        `SELECT p.id, p.name, p.phase, p.status, max(ap.zeitpunkt) AS zeitpunkt,
                c.vorname, c.nachname, c.organisation
         FROM aenderungsprotokoll ap
         JOIN projects p ON p.id = ap.datensatz_id
         JOIN contacts c ON c.id = p.contact_id
         WHERE ap.tabelle = 'projects'
         GROUP BY p.id, p.name, p.phase, p.status, c.vorname, c.nachname, c.organisation
         ORDER BY max(ap.zeitpunkt) DESC
         LIMIT 5`
      )
      .then((r) => r.rows)
  );
  res.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      phase: p.phase,
      status: p.status,
      zeitpunkt: p.zeitpunkt,
      kontaktName: kontaktName(p),
    }))
  );
});

function projektAntwort(p) {
  return {
    id: p.id,
    contactId: p.contact_id,
    name: p.name,
    arten: p.arten,
    status: p.status,
    phase: p.phase,
    objektadresseStrasse: p.objektadresse_strasse,
    objektadressePlz: p.objektadresse_plz,
    objektadresseOrt: p.objektadresse_ort,
    auftragsdatum: p.auftragsdatum,
    ablageLink: p.ablage_link,
    pausiertGrund: p.pausiert_grund,
    erstelltAm: p.erstellt_am,
  };
}

export default router;
