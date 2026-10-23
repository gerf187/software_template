// Lädt Baustein-Konfigurationen und -Seiten der aktuellen App und der gemeinsamen
// Bausteine (packages/modules/) -- rein über Dateipfade, das Fundament kennt
// keinen einzigen Baustein beim Namen (Abschnitt 8).
// Angezeigt wird trotzdem nur, was der Benutzer laut Backend aktiv hat
// (user.module aus /api/auth/me), das hier ist nur das Nachschlagen dazu.
// Gleiche Suchreihenfolge und Namenskonflikt-Regel wie im Backend (module/lade.js).
import * as Symbole from "../icons/index.js";

const AKTUELLE_APP = import.meta.env.VITE_APP || "werkstatt";

const alleConfigs = import.meta.glob(
  [
    "../../../../../../apps/*/modules/*/modul.config.js",
    "../../../../../../packages/modules/*/modul.config.js",
  ],
  { eager: true }
);
const alleSeiten = import.meta.glob([
  "../../../../../../apps/*/modules/*/frontend/Seite.jsx",
  "../../../../../../packages/modules/*/frontend/Seite.jsx",
]);
// Zusätzliche Detailseite eines Bausteins, z. B. die Projekt-Akte neben der
// Projekt-Liste (wie /kontakte/:id im Fundament) -- modul.config.js meldet
// den Pfad über "akteRoute" an (Abschnitt 8).
const alleAkten = import.meta.glob([
  "../../../../../../apps/*/modules/*/frontend/Akte.jsx",
  "../../../../../../packages/modules/*/frontend/Akte.jsx",
]);
// Tabs, die ein Baustein auf der Akte eines ANDEREN Bausteins anmeldet (z. B.
// der Tab "Projekte" auf der Kontakt-Akte, oder künftig "Anträge" auf der
// Projekt-Akte) -- modul.config.js meldet Schlüssel+Beschriftung unter einem
// Erweiterungspunkt an (z. B. "kontaktTabs"), die Komponente liegt in
// frontend/Erweiterungen.jsx, keyed wie Kacheln.jsx.
const alleErweiterungen = import.meta.glob([
  "../../../../../../apps/*/modules/*/frontend/Erweiterungen.jsx",
  "../../../../../../packages/modules/*/frontend/Erweiterungen.jsx",
], { eager: true });

export function modulNameAusPfad(pfad) {
  const teile = pfad.split("/");
  const index = teile.indexOf("modules");
  return index >= 0 ? teile[index + 1] : null;
}

// Nur Bausteine der laufenden App und die gemeinsamen Bausteine zählen.
// Vite kürzt den Glob-Schlüssel auf den kürzesten relativen Pfad -- bei
// "packages/modules/..." fällt "packages" dabei oft weg (gemeinsamer
// Vorfahr mit diesem Ordner selbst), "/packages/modules/" steht also nicht
// zuverlässig im Schlüssel. Alles, was nicht aus "apps/" kommt, kommt aber
// zwangsläufig aus dem zweiten Glob-Muster, also aus packages/modules.
// "app" nur für Tests, im Betrieb immer die laufende App.
export function gehoertDazu(pfad, app = AKTUELLE_APP) {
  if (pfad.includes("/apps/")) return pfad.includes(`/apps/${app}/modules/`);
  return true;
}

// Namenskonflikt zwischen App und gemeinsamen Bausteinen: harter Abbruch, damit
// nie still der falsche Baustein geladen wird (wie im Backend).
// "app" nur für Tests, im Betrieb immer die laufende App.
export function pruefeKonflikte(pfade, app = AKTUELLE_APP) {
  const appNamen = new Set(
    pfade.filter((p) => p.includes(`/apps/${app}/modules/`)).map(modulNameAusPfad)
  );
  for (const pfad of pfade) {
    if (!pfad.includes("/apps/") && appNamen.has(modulNameAusPfad(pfad))) {
      throw new Error(
        `Namenskonflikt: Baustein "${modulNameAusPfad(pfad)}" gibt es in apps/${app}/modules und in packages/modules.`
      );
    }
  }
}

const passendeConfigs = Object.keys(alleConfigs).filter((pfad) => gehoertDazu(pfad));
pruefeKonflikte(passendeConfigs);

export function modulConfig(name) {
  for (const pfad of passendeConfigs) {
    if (modulNameAusPfad(pfad) === name) return alleConfigs[pfad].default;
  }
  return null;
}

// Menü-Symbol eines Bausteins: modul.config.js nennt es per Name aus dem
// Symbol-Satz des Fundaments (icons/index.js, z. B. "IconFolder"). Ohne oder
// mit unbekannter Angabe: neutrales Baustein-Symbol (das Zahnrad bleibt
// Einstellungen vorbehalten).
export function modulSymbol(name) {
  return Symbole[modulConfig(name)?.icon] || Symbole.IconPuzzle;
}

export function modulSeitenLader(name) {
  for (const [pfad, lader] of Object.entries(alleSeiten)) {
    if (gehoertDazu(pfad) && modulNameAusPfad(pfad) === name) return lader;
  }
  return null;
}

export function modulAkteLader(name) {
  for (const [pfad, lader] of Object.entries(alleAkten)) {
    if (gehoertDazu(pfad) && modulNameAusPfad(pfad) === name) return lader;
  }
  return null;
}

// Bezeichnung einer Baustein-Tabelle im Änderungsprotokoll (modul.config.js,
// Feld "protokollTabellen", z. B. { projects: "Projekt" }). Über alle
// Bausteine der App, nicht nur die aktiven: alte Einträge eines inzwischen
// ausgeschalteten Bausteins bleiben im Protokoll und sollen lesbar bleiben.
export function protokollTabellenText(tabelle) {
  for (const pfad of passendeConfigs) {
    const text = alleConfigs[pfad].default?.protokollTabellen?.[tabelle];
    if (text) return text;
  }
  return null;
}

// Alle angemeldeten Tabs eines Erweiterungspunkts (z. B. "kontaktTabs") über
// die aktiven Bausteine eines Benutzers hinweg, in deren Reihenfolge.
export function erweiterungsTabs(punkt, aktiveModule) {
  const tabs = [];
  for (const name of aktiveModule || []) {
    const config = modulConfig(name);
    for (const tab of config?.[punkt] || []) {
      tabs.push({ modul: name, ...tab });
    }
  }
  return tabs;
}

export function erweiterungsKomponente(punkt, modulName, tabKey) {
  for (const [pfad, modul] of Object.entries(alleErweiterungen)) {
    if (gehoertDazu(pfad) && modulNameAusPfad(pfad) === modulName) {
      return modul.default?.[punkt]?.[tabKey] || null;
    }
  }
  return null;
}
