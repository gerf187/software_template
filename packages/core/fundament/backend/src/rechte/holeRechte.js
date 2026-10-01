import { withFirma } from "../db/withFirma.js";

// Liefert die Rechte einer Rolle als { bereich: { sehen, bearbeiten, loeschen } }.
// Wird an den angemeldeten Benutzer gehängt (Login, /me), damit das Frontend
// weiß, was es anzeigen darf -- der Schutz selbst passiert im Backend (darf()).
export async function holeRechteFuerRolle(firmaId, rolle) {
  if (!firmaId) return {}; // Superadmin hat keine Firma und keine Fach-Rechte.

  const rows = await withFirma(firmaId, (client) =>
    client
      .query("SELECT bereich, sehen, bearbeiten, loeschen FROM rechte WHERE rolle = $1", [rolle])
      .then((r) => r.rows)
  );

  const rechte = {};
  for (const row of rows) {
    rechte[row.bereich] = {
      sehen: row.sehen,
      bearbeiten: row.bearbeiten,
      loeschen: row.loeschen,
    };
  }
  return rechte;
}
