import { STANDARD_RECHTE_FUNDAMENT } from "@fundament/backend/src/rechte/fundamentBereiche.js";

export default {
  produktname: "Werkstatt",
  testumgebung: true,
  standardRechte: STANDARD_RECHTE_FUNDAMENT,
  // Welche Bausteine diese App anbietet (Abschnitt 8, erste Ebene der
  // Auswahl). "beispiel" ist nur ein winziger Test-Baustein fürs Modul-System.
  module: ["beispiel", "beispiel-zwei"],
};
