import { pool } from "./pool.js";

// Zentrale Stelle für die Mandanten-Trennung (Abschnitt 6, Regel 4).
// firma_id kommt vom Aufrufer immer aus der Session, nie aus der Anfrage.
// Jede Abfrage läuft innerhalb dieser Funktion, damit die Datenbank
// (Row Level Security) automatisch nur Zeilen der eigenen Firma zeigt.
//
// userId wird genauso per set_config an die Datenbank gereicht und vom
// Änderungsprotokoll-Trigger gelesen (Abschnitt 6) -- dadurch weiß das
// Protokoll, wer eine Änderung gemacht hat, ohne dass jede Route das selbst
// einträgt. Ohne bekannten Nutzer (z. B. Seed-Skripte) bleibt es leer.
export async function withFirma(firmaId, fn, { userId } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_firma_id', $1, true)", [
      String(firmaId),
    ]);
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      userId != null ? String(userId) : "",
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
