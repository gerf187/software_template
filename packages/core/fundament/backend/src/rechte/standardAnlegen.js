// Trägt die Standard-Rechte-Matrix einer App (Abschnitt 8) für eine neue
// Firma in die Tabelle "rechte" ein. Läuft innerhalb von withFirma(), damit
// die Mandanten-Trennung auch hier greift.
export async function rechteStandardAnlegen(client, firmaId, standardRechte) {
  for (const [rolle, bereiche] of Object.entries(standardRechte)) {
    for (const [bereich, aktionen] of Object.entries(bereiche)) {
      await client.query(
        `INSERT INTO rechte (firma_id, rolle, bereich, sehen, bearbeiten, loeschen)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (firma_id, rolle, bereich) DO UPDATE
           SET sehen = EXCLUDED.sehen, bearbeiten = EXCLUDED.bearbeiten, loeschen = EXCLUDED.loeschen`,
        [firmaId, rolle, bereich, !!aktionen.sehen, !!aktionen.bearbeiten, !!aktionen.loeschen]
      );
    }
  }
}

// Ein Baustein meldet seine Rechte-Bereiche selbst an (Abschnitt 8, Regel 1+2)
// -- was ein User darf, legt also der Baustein in seiner modul.config.js fest
// (z. B. { kontakte: { sehen: true, bearbeiten: true, loeschen: false } }),
// nie ein fester Umfang im Fundament-Code. Admin bekommt für jeden vom
// Baustein gemeldeten Bereich automatisch vollen Zugriff eingetragen -- das
// ist reine Daten-Voreinstellung, keine Sonderprüfung auf `rolle` im Code
// (Abschnitt 7: `darf()` kennt nur Zeilen in der Tabelle, nie Rollennamen).
export async function rechteFuerBausteinAnlegen(client, firmaId, rechteBereiche) {
  if (!rechteBereiche) return;

  const admin = {};
  for (const bereich of Object.keys(rechteBereiche)) {
    admin[bereich] = { sehen: true, bearbeiten: true, loeschen: true };
  }

  await rechteStandardAnlegen(client, firmaId, { Admin: admin, User: rechteBereiche });
}
