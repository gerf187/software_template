import { darf } from "../rechte/darf.js";
import { ladeModule } from "../module/lade.js";
import { istModulAktiv } from "../module/firmaModule.js";

// Fundament-eigene Kacheln (Abschnitt 8/10, Teil C: Dashboard neu).
// rechtBereich = welches Recht (Aktion "sehen") für die Sichtbarkeit nötig
// ist -- ohne rechtBereich immer sichtbar. "Letzte Aktivitäten" ist dadurch
// automatisch nur für Admin da (Bereich "protokoll" ist laut Abschnitt 7
// Admin-only), ohne `rolle` im Code zu prüfen.
//
// groesseFest: diese drei zeigen mehrspaltige Inhalte (Begrüßung + Kennzahl,
// eine kleine Tabelle) -- "klein" ergäbe keinen Sinn, darum fest auf "gross"
// (volle Breite), nicht einzeln umschaltbar (Björns Vorgabe, Teil C, C1).
export const FUNDAMENT_KACHELN = [
  { key: "begruessung", titel: "Begrüßung", groesse: "gross", groesseFest: true },
  {
    key: "meineAufgaben",
    titel: "Meine Aufgaben",
    groesse: "gross",
    groesseFest: true,
    rechtBereich: "kontakte",
  },
  {
    key: "zuletztBearbeiteteKontakte",
    titel: "Kontakte",
    groesse: "klein",
    rechtBereich: "kontakte",
  },
  {
    key: "letzteAktivitaeten",
    titel: "Letzte Aktivitäten",
    groesse: "gross",
    groesseFest: true,
    rechtBereich: "protokoll",
  },
];

// Alle Kacheln, die dieser Benutzer gerade sehen dürfte -- Fundament-Kacheln
// plus die Kacheln aktiver Bausteine (modul.config.js, Feld "kacheln", genau
// wie "menuepunkte"). Schlüssel von Baustein-Kacheln bekommen den Modulnamen
// vorangestellt ("modulname:kachelKey"), damit sie nie mit Fundament- oder
// anderen Baustein-Kacheln kollidieren. standardSichtbar = false: die Kachel
// ist verfügbar, taucht aber nicht automatisch auf dem Dashboard auf (z. B.
// der Beispiel-Baustein), bis jemand sie im Anpassen-Modus selbst einschaltet.
export async function holeVerfuegbareKacheln(user) {
  const ergebnis = [];

  for (const kachel of FUNDAMENT_KACHELN) {
    if (kachel.rechtBereich && !(await darf(user, kachel.rechtBereich, "sehen"))) continue;
    ergebnis.push({
      key: kachel.key,
      titel: kachel.titel,
      groesse: kachel.groesse,
      groesseFest: !!kachel.groesseFest,
      standardSichtbar: kachel.standardSichtbar !== false,
    });
  }

  if (!user?.firmaId) return ergebnis; // Superadmin: keine Bausteine, keine Fach-Rechte.

  const module = await ladeModule();
  for (const { name, config } of module) {
    if (!config.kacheln?.length) continue;
    if (!(await istModulAktiv(user.firmaId, name))) continue;

    for (const kachel of config.kacheln) {
      if (kachel.rechtBereich && !(await darf(user, kachel.rechtBereich, "sehen"))) continue;
      ergebnis.push({
        key: `${name}:${kachel.key}`,
        titel: kachel.titel,
        groesse: kachel.groesse || "klein",
        groesseFest: !!kachel.groesseFest,
        standardSichtbar: kachel.standardSichtbar !== false,
      });
    }
  }

  return ergebnis;
}
