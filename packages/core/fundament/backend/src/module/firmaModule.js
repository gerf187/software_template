import { withFirma } from "../db/withFirma.js";

// Zweite Ebene der Auswahl (Abschnitt 8): hat diese Firma den Baustein
// freigeschaltet? Ohne Zeile in firma_module (oder aktiv = false): nein.
export async function istModulAktiv(firmaId, modul) {
  if (!firmaId) return false; // Superadmin hat keine Firma, also keine Bausteine.

  const rows = await withFirma(firmaId, (client) =>
    client
      .query("SELECT aktiv FROM firma_module WHERE firma_id = $1 AND modul = $2", [firmaId, modul])
      .then((r) => r.rows)
  );
  return rows[0]?.aktiv === true;
}

export async function holeAktiveModule(firmaId) {
  if (!firmaId) return [];

  const rows = await withFirma(firmaId, (client) =>
    client.query("SELECT modul FROM firma_module WHERE aktiv = true").then((r) => r.rows)
  );
  return rows.map((r) => r.modul);
}

// Express-Middleware: nicht freigeschaltet = 404, nicht nur 403 -- die Route
// gibt es für diese Firma schlicht nicht (Abschnitt 8, Regel 3).
export function erfordertModul(modul) {
  return async (req, res, next) => {
    if (await istModulAktiv(req.user.firmaId, modul)) {
      return next();
    }
    res.status(404).json({ error: "Nicht gefunden." });
  };
}
