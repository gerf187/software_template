import { pool } from "./pool.js";

// Zentrale Stelle für die Mandanten-Trennung (Abschnitt 6, Regel 4).
// firma_id kommt vom Aufrufer immer aus der Session, nie aus der Anfrage.
// Jede Abfrage läuft innerhalb dieser Funktion, damit die Datenbank
// (Row Level Security) automatisch nur Zeilen der eigenen Firma zeigt.
export async function withFirma(firmaId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_firma_id', $1, true)", [
      String(firmaId),
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
