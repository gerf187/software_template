// Lädt Baustein-Konfigurationen und -Seiten aller Apps, rein über Dateipfade --
// das Fundament kennt keinen einzigen Baustein beim Namen (Abschnitt 8).
// Angezeigt wird trotzdem nur, was der Benutzer laut Backend aktiv hat
// (user.module aus /api/auth/me), das hier ist nur das Nachschlagen dazu.
const configModule = import.meta.glob("../../../../../../apps/*/modules/*/modul.config.js", {
  eager: true,
});
const seitenModule = import.meta.glob("../../../../../../apps/*/modules/*/frontend/Seite.jsx");

function modulNameAusPfad(pfad) {
  const teile = pfad.split("/");
  const index = teile.indexOf("modules");
  return index >= 0 ? teile[index + 1] : null;
}

export function modulConfig(name) {
  for (const [pfad, modul] of Object.entries(configModule)) {
    if (modulNameAusPfad(pfad) === name) return modul.default;
  }
  return null;
}

export function modulSeitenLader(name) {
  for (const [pfad, lader] of Object.entries(seitenModule)) {
    if (modulNameAusPfad(pfad) === name) return lader;
  }
  return null;
}
