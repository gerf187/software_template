import pg from "pg";

// Eigentümer-Zugang (POSTGRES_USER, nicht die eingeschränkte Rolle "app") für
// Kommandozeilen-Befehle, die eine Plattform-Rolle anlegen oder ändern -- wie
// die Migrationen. Dafür gibt es bewusst keine Web-Route (Abschnitt 7).
export function eigentuemerVerbindung() {
  const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } =
    process.env;
  return new pg.Pool({
    connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
  });
}
