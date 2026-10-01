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
