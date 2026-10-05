// IDs aus der URL: nur ganze positive Zahlen, die in eine Datenbank-Spalte
// vom Typ INTEGER passen. Alles andere (z. B. "abc") ist "nicht gefunden",
// nicht ein Serverfehler (404 statt 500).
const HOECHSTE_ID = 2147483647;

export function istGueltigeId(wert) {
  if (!/^[1-9]\d*$/.test(String(wert))) return false;
  return Number(wert) <= HOECHSTE_ID;
}

// Prüft die genannten URL-Parameter für alle Routen dieses Routers, bevor
// die Route selbst läuft. Ungültig → 404 "Nicht gefunden.".
export function pruefeIdsAusUrl(router, namen) {
  for (const name of namen) {
    router.param(name, (req, res, next, wert) => {
      if (!istGueltigeId(wert)) {
        return res.status(404).json({ error: "Nicht gefunden." });
      }
      next();
    });
  }
}

// PostgreSQL meldet einen Fremdschlüssel-Verstoß mit Code 23503. Hier heißt
// das: die Zieldatenzeile (z. B. ein Kontakt) existiert in dieser Firma nicht.
export function istFremdschluesselFehler(err) {
  return err?.code === "23503";
}
