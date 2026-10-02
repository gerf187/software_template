import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { erfordertRecht } from "./darf.js";
import { withFirma } from "../db/withFirma.js";

const router = Router();

// Seite "Wer sieht was" unter Einstellungen (Abschnitt 7): nur lesen, und nur
// die Rolle "User" -- Admin hat ohnehin immer vollen Zugriff, eine eigene
// Zeile dafür wäre nur verwirrend ("ist das bearbeitbar?").
router.get("/", requireAuth, erfordertRecht("einstellungen", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(
        "SELECT bereich, sehen, bearbeiten, loeschen FROM rechte WHERE rolle = 'User' ORDER BY bereich"
      )
      .then((r) => r.rows)
  );
  res.json(rows);
});

export default router;
