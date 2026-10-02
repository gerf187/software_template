import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { erfordertRecht } from "../rechte/darf.js";
import { withFirma } from "../db/withFirma.js";

const router = Router();
router.use(requireAuth);

const AUFGABEN_LIMIT = 10;

function kontaktName(a) {
  return [a.vorname, a.nachname].filter(Boolean).join(" ") || "(ohne Namen)";
}

// Start-Dashboard (Abschnitt 12, Schritt 4): zeigt, was es im Fundament schon
// gibt -- Kontakte und ihre freien Aufgaben. Noch kein "Baustein" aus dem
// Katalog (Abschnitt 13), nur die Fundament-eigene Startseite.
router.get("/", erfordertRecht("kontakte", "sehen"), async (req, res) => {
  const daten = await withFirma(req.user.firmaId, async (client) => {
    const kontakte = await client.query(
      "SELECT count(*)::int AS anzahl FROM contacts WHERE deleted_at IS NULL"
    );
    const anzahlAufgaben = await client.query(
      `SELECT count(*)::int AS anzahl FROM tasks t
       JOIN contacts c ON c.id = t.contact_id
       WHERE t.status = 'offen' AND t.deleted_at IS NULL AND c.deleted_at IS NULL`
    );
    const aufgaben = await client.query(
      `SELECT t.id, t.text, t.faellig_am, t.contact_id, c.vorname, c.nachname
       FROM tasks t
       JOIN contacts c ON c.id = t.contact_id
       WHERE t.status = 'offen' AND t.deleted_at IS NULL AND c.deleted_at IS NULL
       ORDER BY t.faellig_am NULLS LAST, t.erstellt_am
       LIMIT $1`,
      [AUFGABEN_LIMIT]
    );
    return {
      anzahlKontakte: kontakte.rows[0].anzahl,
      anzahlOffenerAufgaben: anzahlAufgaben.rows[0].anzahl,
      aufgabenRows: aufgaben.rows,
    };
  });

  res.json({
    anzahlKontakte: daten.anzahlKontakte,
    anzahlOffenerAufgaben: daten.anzahlOffenerAufgaben,
    aufgaben: daten.aufgabenRows.map((a) => ({
      id: a.id,
      text: a.text,
      faelligAm: a.faellig_am,
      kontaktId: a.contact_id,
      kontaktName: kontaktName(a),
    })),
  });
});

export default router;
