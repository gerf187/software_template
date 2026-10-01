import { withFirma } from "../db/withFirma.js";

// Zentrale Rechte-Prüfung (Abschnitt 7): nie "rolle === 'Admin'" im Code,
// immer darf(user, bereich, aktion). aktion ist "sehen", "bearbeiten" oder
// "loeschen". Ohne passende Zeile in der Rechte-Matrix: keine Berechtigung.
export async function darf(user, bereich, aktion) {
  if (!user || !user.firmaId) return false; // Superadmin: keine Firma, keine Fach-Rechte.

  const rows = await withFirma(user.firmaId, (client) =>
    client
      .query("SELECT sehen, bearbeiten, loeschen FROM rechte WHERE rolle = $1 AND bereich = $2", [
        user.rolle,
        bereich,
      ])
      .then((r) => r.rows)
  );

  return rows[0] ? !!rows[0][aktion] : false;
}

// Express-Middleware: hinter requireAuth einhängen. Keine Berechtigung → 403
// "Keine Berechtigung." (Anhang A.4), nie eine andere Fehlermeldung.
export function erfordertRecht(bereich, aktion) {
  return async (req, res, next) => {
    if (await darf(req.user, bereich, aktion)) {
      return next();
    }
    res.status(403).json({ error: "Keine Berechtigung." });
  };
}
