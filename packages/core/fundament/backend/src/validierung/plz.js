// PLZ-Regel (Kontakt und Baustein-Adressen): leer ist erlaubt, sonst genau
// fünf Ziffern. Reines JavaScript ohne Node-Abhängigkeit -- das Frontend
// importiert dieselbe Datei, damit beide Seiten nie auseinanderlaufen.
export const PLZ_FEHLER = "Die PLZ muss aus genau 5 Ziffern bestehen.";

// Liefert die Fehlermeldung oder null, wenn die PLZ passt.
export function pruefePlz(plz) {
  const wert = String(plz ?? "").trim();
  if (wert === "") return null;
  return /^\d{5}$/.test(wert) ? null : PLZ_FEHLER;
}
