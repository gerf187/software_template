import pg from "pg";

const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, APP_DB_USER, APP_DB_PASSWORD } = process.env;

if (!APP_DB_USER || !APP_DB_PASSWORD) {
  throw new Error(
    "Datenbank-Zugang fehlt. Bitte zuerst im Projekt-Wurzelverzeichnis: cp .env.example .env"
  );
}

const connectionString = `postgres://${APP_DB_USER}:${APP_DB_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;

export const pool = new pg.Pool({ connectionString });

// Verbindungen im Leerlauf können abbrechen (z. B. Neustart der Datenbank).
// Ohne diesen Empfänger beendet Node den ganzen Prozess. Der Pool baut die
// Verbindung bei der nächsten Anfrage neu auf.
pool.on("error", (err) => {
  console.error("Datenbankverbindung unterbrochen (wird bei der nächsten Anfrage neu aufgebaut):", err.message);
});
