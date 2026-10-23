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
      // groesseFest: die gespeicherte Größe wird ignoriert, nicht einzeln
      // umschaltbar (Teil C, C1) -- wie die Rechte-Prüfung gilt das auch
      // hier im Backend, nicht nur als ausgeblendeter Knopf im Frontend.
      groesse: kachel.groesseFest ? kachel.groesse : groesseOder(eintrag, kachel.groesse),
      groesseFest: !!kachel.groesseFest,
    });
  }

  for (const kachel of verfuegbareKacheln) {
    if (bekannteKeys.has(kachel.key)) continue;
    gerendert.push({
      key: kachel.key,
      titel: kachel.titel,
      sichtbar: kachel.standardSichtbar !== false,
      groesse: kachel.groesse,
      groesseFest: !!kachel.groesseFest,
    });
  }

  return gerendert;
}

// Beim Speichern: das neue Layout (vom Frontend, nur die aktuell bekannten
// Kacheln) wird mit den Einträgen zusammengeführt, die gerade nicht verfügbar
// sind -- die bleiben unverändert erhalten, statt beim Speichern zu verschwinden.
export function layoutZumSpeichern(neuesLayout, gespeichertesLayout, verfuegbareKacheln) {
  const verfuegbarMap = new Map(verfuegbareKacheln.map((k) => [k.key, k]));
  const nichtVerfuegbar = (gespeichertesLayout || []).filter((e) => !verfuegbarMap.has(e.key));
  const neu = (neuesLayout || [])
    .filter((e) => verfuegbarMap.has(e.key))
    .map((e) => {
      const kachel = verfuegbarMap.get(e.key);
      return {
        key: e.key,
        sichtbar: e.sichtbar !== false,
        groesse: kachel.groesseFest ? kachel.groesse : groesseOder(e, "klein"),
      };
    });
  return [...neu, ...nichtVerfuegbar];
}
