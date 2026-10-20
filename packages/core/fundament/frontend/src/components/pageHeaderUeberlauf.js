// Wie viele Nebenaktionen passen noch in den Seitenkopf, bevor der Rest ins
// "⋯"-Menü wandert (Abschnitt 9, Punkt 0.3)? Bei jeder Bildschirmbreite gilt:
// was nicht passt, wird nie abgeschnitten, sondern wandert ins Menü. Reine
// Funktion -- PageHeader.jsx misst die echten Breiten und ruft sie auf.
//
// verfuegbar: Platz für die ganze Nebenaktionen-Zeile (inkl. "⋯"-Knopf)
// breiten: Breite jeder Nebenaktion in Reihenfolge
// mehrKnopfBreite: Breite des "⋯"-Knopfs
// luecke: Abstand zwischen zwei Elementen in der Zeile
export function sichtbareNebenaktionen({ verfuegbar, breiten, mehrKnopfBreite, luecke }) {
  const gesamtOhneMenu = breiten.reduce((summe, breite, i) => summe + breite + (i > 0 ? luecke : 0), 0);
  if (gesamtOhneMenu <= verfuegbar) return breiten.length; // alles passt, kein Menü nötig

  const platz = verfuegbar - mehrKnopfBreite;
  let kumulativ = 0;
  let anzahl = 0;
  for (let i = 0; i < breiten.length; i++) {
    const naechste = kumulativ + breiten[i] + luecke; // Lücke vor dem Knopf oder vor dem Menü
    if (naechste > platz) break;
    kumulativ = naechste;
    anzahl++;
  }
  return anzahl;
}
