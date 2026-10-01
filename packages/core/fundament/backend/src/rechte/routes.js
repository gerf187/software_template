import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { erfordertRecht } from "./darf.js";
import { withFirma } from "../db/withFirma.js";

const router = Router();

// Seite "Wer sieht was" unter Einstellungen (Abschnitt 7): nur lesen.
router.get("/", requireAuth, erfordertRecht("einstellungen", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query("SELECT rolle, bereich, sehen, bearbeiten, loeschen FROM rechte ORDER BY rolle, bereich")
      .then((r) => r.rows)
  );
  res.json(rows);
});

export default router;
