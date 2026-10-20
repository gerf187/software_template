import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { darf } from "../rechte/darf.js";
import { withFirma } from "../db/withFirma.js";
import { geladeneModule } from "../module/geladen.js";

const router = Router();
router.use(requireAuth);

const TREFFER_PRO_QUELLE = 8;
const MINDESTLAENGE = 2;

function kontaktName(k) {
  return [k.vorname, k.nachname].filter(Boolean).join(" ") || "(ohne Namen)";
}

// Globale Suche (Abschnitt 2, Fundament) plus Suchquellen aktiver Bausteine
// (Abschnitt 8, Regel 1: backend/suche.js, optional, siehe module/lade.js).
// req.user.module kommt aus der Sitzungsprüfung schon aktuell (middleware.js
// liest es bei jeder Anfrage neu) -- kein zweiter Datenbank-Zugriff nötig, um
// zu wissen, welche Bausteine diese Firma gerade freigeschaltet hat.
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

  for (const { name, suche: sucheFn } of geladeneModule) {
    if (!sucheFn) continue;
    if (!req.user.module?.includes(name)) continue;
    const treffer = await sucheFn({ user: req.user, suche, limit: TREFFER_PRO_QUELLE, darf, withFirma });
    ergebnisse.push(...(treffer || []));
  }

  res.json(ergebnisse);
});

export default router;
