// Suchquelle für die globale Suche (Abschnitt 8, Regel 1; module/lade.js lädt
// diese Datei automatisch, wenn sie existiert). Durchsucht Projektname und
// Objektadresse (Teil 1, Punkt 9).
const TREFFER_PRO_QUELLE_STANDARD = 8;

export default async function suchen({ user, suche, limit = TREFFER_PRO_QUELLE_STANDARD, darf, withFirma }) {
  if (!(await darf(user, "projekte", "sehen"))) return [];

  const rows = await withFirma(user.firmaId, (client) =>
    client
      .query(
        `SELECT id, name FROM projects
         WHERE deleted_at IS NULL
           AND (name ILIKE '%' || $1 || '%'
                OR objektadresse_ort ILIKE '%' || $1 || '%'
                OR objektadresse_strasse ILIKE '%' || $1 || '%')
         ORDER BY name
         LIMIT $2`,
        [suche, limit]
      )
      .then((r) => r.rows)
  );

  return rows.map((p) => ({
    typ: "projekt",
    id: p.id,
    titel: p.name,
    untertitel: null,
    to: `/projekte/${p.id}`,
  }));
}
