// USt-IdNr.-Regel (Firmen-Kundendaten, Teil A): leer ist erlaubt, sonst "DE"
// gefolgt von genau 9 Ziffern. Reine Formatprüfung, keine Prüfziffer-Kontrolle
// (Björns Entscheidung). Reines JavaScript ohne Node-Abhängigkeit -- das
// Frontend importiert dieselbe Datei, damit beide Seiten nie auseinanderlaufen.
export const UST_ID_NR_FEHLER = "Die USt-IdNr. muss aus \"DE\" und genau 9 Ziffern bestehen.";

// Liefert die Fehlermeldung oder null, wenn die USt-IdNr. passt.
export function pruefeUstIdNr(ustIdNr) {
  const wert = String(ustIdNr ?? "").trim();
  if (wert === "") return null;
  return /^DE\d{9}$/i.test(wert) ? null : UST_ID_NR_FEHLER;
}
