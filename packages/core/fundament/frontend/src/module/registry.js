// Lädt Baustein-Konfigurationen und -Seiten der aktuellen App und der gemeinsamen
// Bausteine (packages/modules/) -- rein über Dateipfade, das Fundament kennt
// keinen einzigen Baustein beim Namen (Abschnitt 8).
// Angezeigt wird trotzdem nur, was der Benutzer laut Backend aktiv hat
// (user.module aus /api/auth/me), das hier ist nur das Nachschlagen dazu.
// Gleiche Suchreihenfolge und Namenskonflikt-Regel wie im Backend (module/lade.js).
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

function modulNameAusPfad(pfad) {
  const teile = pfad.split("/");
  const index = teile.indexOf("modules");
  return index >= 0 ? teile[index + 1] : null;
}

// Nur Bausteine der laufenden App und die gemeinsamen Bausteine zählen.
function gehoertDazu(pfad) {
  return pfad.includes(`/apps/${AKTUELLE_APP}/modules/`) || pfad.includes("/packages/modules/");
}

// Namenskonflikt zwischen App und gemeinsamen Bausteinen: harter Abbruch, damit
// nie still der falsche Baustein geladen wird (wie im Backend).
function pruefeKonflikte(pfade) {
  const appNamen = new Set(
    pfade.filter((p) => p.includes(`/apps/${AKTUELLE_APP}/modules/`)).map(modulNameAusPfad)
  );
  for (const pfad of pfade) {
    if (pfad.includes("/packages/modules/") && appNamen.has(modulNameAusPfad(pfad))) {
      throw new Error(
        `Namenskonflikt: Baustein "${modulNameAusPfad(pfad)}" gibt es in apps/${AKTUELLE_APP}/modules und in packages/modules.`
      );
    }
  }
}

const passendeConfigs = Object.keys(alleConfigs).filter(gehoertDazu);
pruefeKonflikte(passendeConfigs);

export function modulConfig(name) {
  for (const pfad of passendeConfigs) {
    if (modulNameAusPfad(pfad) === name) return alleConfigs[pfad].default;
  }
  return null;
}

export function modulSeitenLader(name) {
  for (const [pfad, lader] of Object.entries(alleSeiten)) {
    if (gehoertDazu(pfad) && modulNameAusPfad(pfad) === name) return lader;
  }
  return null;
}
