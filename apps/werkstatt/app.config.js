import { STANDARD_RECHTE_FUNDAMENT } from "@fundament/backend/src/rechte/fundamentBereiche.js";

export default {
  produktname: "Werkstatt",
  testumgebung: true,
  standardRechte: STANDARD_RECHTE_FUNDAMENT,
  // Welche Bausteine diese App anbietet (Abschnitt 8, erste Ebene der
  // Auswahl). "beispiel" ist nur ein winziger Test-Baustein fürs Modul-System.
  module: ["beispiel", "beispiel-zwei", "projekte"],
  // Einstellungen des Bausteins "Projekte" (Abschnitt 8: "Weitere
  // Einstellungen" -- Projektarten, Status, Phasen, Beschriftung des
  // Auftragsdatums). Hier: neutrale Demo-Werte (Abschnitt 12, Werkstatt).
  projekte: {
    projektarten: ["Typ A", "Typ B"],
    status: [
      { label: "Aktiv" },
      { label: "Pausiert (manuell)", grundPflicht: true },
      { label: "Pausiert (Eskalation)", nurAutomatisch: true },
      { label: "Abgeschlossen", terminal: true },
      { label: "Storniert", terminal: true },
    ],
    phasen: ["Start", "In Arbeit", "Abschluss"],
    auftragsdatumLabel: "Auftragsdatum",
  },
};
