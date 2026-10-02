import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { darf } from "../rechte/darf.js";
import { withFirma } from "../db/withFirma.js";

const router = Router();
router.use(requireAuth);

const TREFFER_PRO_QUELLE = 8;
const MINDESTLAENGE = 2;

function kontaktName(k) {
  return [k.vorname, k.nachname].filter(Boolean).join(" ") || "(ohne Namen)";
}

// Globale Suche (Abschnitt 2, Fundament). Durchsucht bisher nur Kontakte --
// das Fundament kennt noch keinen Baustein mit eigener Suchquelle (Abschnitt 8,
// Regel 1 sieht das für künftige Bausteine vor, aktuell gibt es keinen).
router.get("/", async (req, res) => {
  const suche = (req.query.q || "").trim();
  if (suche.length < MINDESTLAENGE) return res.json([]);

  const ergebnisse = [];

  if (await darf(req.user, "kontakte", "sehen")) {
    const rows = await withFirma(req.user.firmaId, (client) =>
      client
        .query(
          `SELECT id, vorname, nachname, organisation FROM contacts
           WHERE deleted_at IS NULL
             AND (nachname ILIKE '%' || $1 || '%' OR
                  vorname ILIKE '%' || $1 || '%' OR
                  organisation ILIKE '%' || $1 || '%' OR
                  email ILIKE '%' || $1 || '%')
           ORDER BY nachname, vorname
           LIMIT $2`,
          [suche, TREFFER_PRO_QUELLE]
        )
        .then((r) => r.rows)
    );
    for (const k of rows) {
      ergebnisse.push({
        typ: "kontakt",
        id: k.id,
        titel: kontaktName(k),
        untertitel: k.organisation || null,
        to: `/kontakte/${k.id}`,
      });
    }
  }

  res.json(ergebnisse);
});

export default router;
