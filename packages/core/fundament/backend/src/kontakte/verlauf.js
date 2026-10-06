// Änderungsverlauf eines Kontakts: lesbare Feldnamen, nur geänderte Felder, und
// Verweise auf andere Datensätze mit Namen statt Nummer.

// Feldname → Anzeigename. Felder, die hier fehlen (id, firma_id, Zeitstempel, ...)
// oder entfernt sind, erscheinen nicht.
export const VERLAUF_FELDER = {
  anrede: "Anrede",
  vorname: "Vorname",
  nachname: "Nachname",
  organisation: "Organisation",
  email: "E-Mail",
  telefon: "Telefon",
  mobil: "Mobil",
  wohnadresse_strasse: "Straße",
  wohnadresse_plz: "PLZ",
  wohnadresse_ort: "Ort",
};

// Feldname → Ziel: welche Tabelle und welche Spalte den Anzeigenamen liefert.
// Am Kontakt gibt es heute kein solches Feld; die Auflösung ist vorbereitet.
export const VERLAUF_VERWEISE = {};

// Nur Tabellen, die hier stehen, dürfen als Verweis aufgelöst werden (keine Freitext-SQL).
const ANZEIGE_TABELLEN = {
  users: { spalte: ["name"], bedingung: "" },
  contacts: { spalte: ["nachname"], bedingung: "AND deleted_at IS NULL" },
};

const LEER = "(leer)";
const GELOESCHT = "(gelöscht)";

// Geänderte Felder mit altem und neuem Wert. Der Feldname bleibt erhalten, damit
// Verweise später aufgelöst werden können.
export function aenderungenAus(alt, neu, felder = VERLAUF_FELDER) {
  if (!alt || !neu) return [];
  return Object.keys(felder)
    .filter((k) => JSON.stringify(alt[k] ?? null) !== JSON.stringify(neu[k] ?? null))
    .map((k) => ({ feldname: k, feld: felder[k], alt: alt[k] ?? null, neu: neu[k] ?? null }));
}

// Ersetzt Verweis-Nummern durch Namen. Fehlt der Datensatz (oder gehört er einer
// anderen Firma), steht dort "(gelöscht)". Erwartet die Liste aus mehreren Einträgen.
export async function loeseVerweiseAuf(client, firmaId, listen, verweise = VERLAUF_VERWEISE) {
  // Alle benötigten Nummern je Tabelle sammeln, dann je Tabelle eine Abfrage.
  const gesucht = {};
  for (const liste of listen) {
    for (const a of liste) {
      const ziel = verweise[a.feldname];
      if (!ziel) continue;
      gesucht[ziel.tabelle] ??= new Set();
      for (const wert of [a.alt, a.neu]) if (wert != null) gesucht[ziel.tabelle].add(wert);
    }
  }

  const namen = {};
  for (const [tabelle, ids] of Object.entries(gesucht)) {
    const konfig = ANZEIGE_TABELLEN[tabelle];
    if (!konfig) throw new Error(`Verweis auf ${tabelle} ist nicht freigegeben.`);
    const { rows } = await client.query(
      `SELECT id, ${konfig.spalte[0]} AS anzeige FROM ${tabelle}
       WHERE firma_id = $1 AND id = ANY($2::int[]) ${konfig.bedingung}`,
      [firmaId, [...ids]]
    );
    namen[tabelle] = new Map(rows.map((r) => [Number(r.id), r.anzeige]));
  }

  return listen.map((liste) =>
    liste.map((a) => {
      const ziel = verweise[a.feldname];
      if (!ziel) return { feld: a.feld, alt: a.alt ?? LEER, neu: a.neu ?? LEER };
      const aufloesen = (wert) =>
        wert == null ? LEER : namen[ziel.tabelle].get(Number(wert)) ?? GELOESCHT;
      return { feld: a.feld, alt: aufloesen(a.alt), neu: aufloesen(a.neu) };
    })
  );
}
