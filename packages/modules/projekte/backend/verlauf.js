// Änderungsverlauf eines Projekts: lesbare Feldnamen, nur geänderte Felder.
// Gleiches Muster wie kontakte/verlauf.js im Fundament, hier eigenständig für
// den Baustein (Abschnitt 8, Regel 1: bringt alles selbst mit).

export const VERLAUF_FELDER = {
  name: "Projektname",
  arten: "Projektart(en)",
  status: "Status",
  phase: "Phase",
  objektadresse_strasse: "Straße",
  objektadresse_plz: "PLZ",
  objektadresse_ort: "Ort",
  auftragsdatum: "Auftragsdatum",
  ablage_link: "Ablage-Link",
  pausiert_grund: "Grund der Pausierung",
};

const LEER = "(leer)";

function anzeige(wert) {
  if (wert == null) return LEER;
  if (Array.isArray(wert)) return wert.length ? wert.join(", ") : LEER;
  return String(wert);
}

// Geänderte Felder mit altem und neuem Wert (als Anzeige-Text).
export function aenderungenAus(alt, neu) {
  if (!alt || !neu) return [];
  return Object.keys(VERLAUF_FELDER)
    .filter((k) => JSON.stringify(alt[k] ?? null) !== JSON.stringify(neu[k] ?? null))
    .map((k) => ({ feld: VERLAUF_FELDER[k], alt: anzeige(alt[k]), neu: anzeige(neu[k]) }));
}
