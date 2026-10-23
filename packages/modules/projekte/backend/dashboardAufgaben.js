// Erweiterungspunkt der Dashboard-Kachel "Meine Aufgaben" (Teil C, Punkt C2):
// löst project_id (Fundament-Tabelle "tasks") zu Name und Akte-Link auf --
// das Fundament kennt "Projekt" selbst nicht (Abschnitt 8, Regel 5). Wird von
// module/lade.js automatisch gefunden, genau wie "backend/suche.js".
export default async function dashboardAufgaben({ firmaId, projectIds, withFirma }) {
  if (!projectIds?.length) return {};

  const rows = await withFirma(firmaId, (client) =>
    client
      .query("SELECT id, name FROM projects WHERE firma_id = $1 AND id = ANY($2)", [firmaId, projectIds])
      .then((r) => r.rows)
  );

  return Object.fromEntries(rows.map((p) => [p.id, { name: p.name, to: `/projekte/${p.id}` }]));
}
