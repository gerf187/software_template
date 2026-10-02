const GROESSEN = new Set(["klein", "gross"]);

function groesseOder(eintrag, fallback) {
  return GROESSEN.has(eintrag?.groesse) ? eintrag.groesse : fallback;
}

// Baut die anzuzeigende Liste aus dem gespeicherten Layout und den aktuell
// verfügbaren Kacheln (Abschnitt 8): bekannte Kacheln behalten Reihenfolge,
// Sichtbarkeit und Größe, neu verfügbare Kacheln (z. B. frisch freigeschalteter
// Baustein) kommen ans Ende. Nicht mehr verfügbare Einträge (Baustein aus,
// Recht weg) werden hier nicht angezeigt, aber nicht gelöscht -- die Position
// bleibt im gespeicherten Layout erhalten (Abschnitt 8, Regel 4: Ausschalten
// = ausblenden, nicht löschen).
export function gerenderteKacheln(gespeichertesLayout, verfuegbareKacheln) {
  const verfuegbarMap = new Map(verfuegbareKacheln.map((k) => [k.key, k]));
  const bekannteKeys = new Set();

  const gerendert = [];
  for (const eintrag of gespeichertesLayout) {
    bekannteKeys.add(eintrag.key);
    const kachel = verfuegbarMap.get(eintrag.key);
    if (!kachel) continue;
    gerendert.push({
      key: kachel.key,
      titel: kachel.titel,
      sichtbar: eintrag.sichtbar !== false,
      groesse: groesseOder(eintrag, kachel.groesse),
    });
  }

  for (const kachel of verfuegbareKacheln) {
    if (bekannteKeys.has(kachel.key)) continue;
    gerendert.push({ key: kachel.key, titel: kachel.titel, sichtbar: true, groesse: kachel.groesse });
  }

  return gerendert;
}

// Beim Speichern: das neue Layout (vom Frontend, nur die aktuell bekannten
// Kacheln) wird mit den Einträgen zusammengeführt, die gerade nicht verfügbar
// sind -- die bleiben unverändert erhalten, statt beim Speichern zu verschwinden.
export function layoutZumSpeichern(neuesLayout, gespeichertesLayout, verfuegbareKacheln) {
  const verfuegbarKeys = new Set(verfuegbareKacheln.map((k) => k.key));
  const nichtVerfuegbar = (gespeichertesLayout || []).filter((e) => !verfuegbarKeys.has(e.key));
  const neu = (neuesLayout || [])
    .filter((e) => verfuegbarKeys.has(e.key))
    .map((e) => ({
      key: e.key,
      sichtbar: e.sichtbar !== false,
      groesse: groesseOder(e, "klein"),
    }));
  return [...neu, ...nichtVerfuegbar];
}
