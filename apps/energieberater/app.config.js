import { STANDARD_RECHTE_FUNDAMENT } from "@fundament/backend/src/rechte/fundamentBereiche.js";

export default {
  produktname: "Energieberater",
  standardRechte: STANDARD_RECHTE_FUNDAMENT,
  module: ["projekte"],
  // "Kombi" (iSFP + BEG EM) ist bewusst keine eigene Projektart, sondern
  // Mehrfachauswahl beider (Teil 1, Punkt 2).
  projekte: {
    projektarten: ["iSFP", "BEG EM"],
    status: [
      { label: "Aktiv", farbe: "success" },
      { label: "Pausiert (manuell)", grundPflicht: true, farbe: "warn" },
      { label: "Pausiert (Eskalation)", nurAutomatisch: true, farbe: "warn" },
      { label: "Abgeschlossen", terminal: true, farbe: "neutral" },
      { label: "Storniert", terminal: true, farbe: "neutral" },
    ],
    phasen: ["Beauftragt", "Datenaufnahme", "Bearbeitung", "Abrechnung", "Abgeschlossen"],
    auftragsdatumLabel: "Datum Auftragsbestätigung",
  },
};
