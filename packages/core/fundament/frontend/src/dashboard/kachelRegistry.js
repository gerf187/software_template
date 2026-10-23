import Begruessung from "./kacheln/Begruessung.jsx";
import MeineAufgaben from "./kacheln/MeineAufgaben.jsx";
import ZuletztBearbeiteteKontakte from "./kacheln/ZuletztBearbeiteteKontakte.jsx";
import NeueKontakte from "./kacheln/NeueKontakte.jsx";
import KontakteGesamt from "./kacheln/KontakteGesamt.jsx";
import LetzteAktivitaeten from "./kacheln/LetzteAktivitaeten.jsx";
import { modulNameAusPfad, gehoertDazu } from "../module/registry.js";

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
  [
    "../../../../../../apps/*/modules/*/frontend/Kacheln.jsx",
    "../../../../../../packages/modules/*/frontend/Kacheln.jsx",
  ],
  { eager: true }
);

// Sucht die Kachel "modulname:kachelKey" in den gefundenen Kacheln.jsx-Dateien.
// Wie registry.js: nur Bausteine der laufenden App und aus packages/modules --
// sonst könnte ein gleichnamiger Baustein einer anderen App gefunden werden.
// Eigene Funktion mit Parametern, damit Tests sie mit Beispiel-Pfaden prüfen können.
export function sucheModulKachel(kachelModule, key, app) {
  const [modulName, kachelKey] = key.split(":");
  for (const [pfad, modul] of Object.entries(kachelModule)) {
    if (gehoertDazu(pfad, app) && modulNameAusPfad(pfad) === modulName) {
      return modul.default?.[kachelKey] || null;
    }
  }
  return null;
}

export function kachelKomponente(key) {
  if (FUNDAMENT_KACHELN[key]) return FUNDAMENT_KACHELN[key];
  return sucheModulKachel(modulKachelModule, key);
}
