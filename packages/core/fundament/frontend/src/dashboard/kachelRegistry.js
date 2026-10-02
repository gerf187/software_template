import Begruessung from "./kacheln/Begruessung.jsx";
import MeineAufgaben from "./kacheln/MeineAufgaben.jsx";
import ZuletztBearbeiteteKontakte from "./kacheln/ZuletztBearbeiteteKontakte.jsx";
import NeueKontakte from "./kacheln/NeueKontakte.jsx";
import KontakteGesamt from "./kacheln/KontakteGesamt.jsx";
import LetzteAktivitaeten from "./kacheln/LetzteAktivitaeten.jsx";

const FUNDAMENT_KACHELN = {
  begruessung: Begruessung,
  meineAufgaben: MeineAufgaben,
  zuletztBearbeiteteKontakte: ZuletztBearbeiteteKontakte,
  neueKontakte: NeueKontakte,
  kontakteGesamt: KontakteGesamt,
  letzteAktivitaeten: LetzteAktivitaeten,
};

// Bausteine melden ihre Kachel-Komponenten über frontend/Kacheln.jsx an --
// genau wie Seite.jsx für Menüpunkte (Abschnitt 8). Schlüssel im Backend sind
// "modulname:kachelKey" (Rechte-Prüfung übernimmt der Server, hier wird nur
// die passende Komponente gesucht).
const modulKachelModule = import.meta.glob(
  "../../../../../../apps/*/modules/*/frontend/Kacheln.jsx",
  { eager: true }
);

function modulNameAusPfad(pfad) {
  const teile = pfad.split("/");
  const index = teile.indexOf("modules");
  return index >= 0 ? teile[index + 1] : null;
}

export function kachelKomponente(key) {
  if (FUNDAMENT_KACHELN[key]) return FUNDAMENT_KACHELN[key];

  const [modulName, kachelKey] = key.split(":");
  for (const [pfad, modul] of Object.entries(modulKachelModule)) {
    if (modulNameAusPfad(pfad) === modulName) {
      return modul.default?.[kachelKey] || null;
    }
  }
  return null;
}
