// Baustein "Projekte" (Abschnitt 5/12, Teil 1): branchenneutraler Rahmen für
// Projekt-Akten. Phasen-Namen, Status-Liste, Projektarten und die
// Beschriftung des Auftragsdatums kommen aus app.config.js (Feld "projekte"),
// nie fest im Baustein-Code (Abschnitt 8: "Weitere Einstellungen").
export default {
  titel: "Projekte",
  beschreibung: "Projekt-Akten mit Phasen-Leiste, Notizen, Aufgaben und Verlauf.",
  braucht: [],
  menuepunkte: [{ key: "projekte", label: "Projekte", to: "/projekte" }],
  akteRoute: "/projekte/:id",

  // Abschnitt 7: was die Rolle User in diesem Baustein darf. Admin bekommt
  // beim Freischalten automatisch vollen Zugriff (rechteFuerBausteinAnlegen).
  rechteBereiche: {
    projekte: { sehen: true, bearbeiten: true, loeschen: false },
  },

  kacheln: [
    { key: "nachPhase", titel: "Aktive Projekte nach Phase", groesse: "klein", rechtBereich: "projekte" },
    { key: "zuletzt", titel: "Zuletzt bearbeitete Projekte", groesse: "klein", rechtBereich: "projekte" },
  ],

  // Tab "Projekte" auf der Kontakt-Akte (Abschnitt 11/Teil 1, Punkt 7) --
  // Erweiterungspunkt des Fundaments (frontend/Erweiterungen.jsx).
  kontaktTabs: [{ key: "projekte", label: "Projekte" }],

  // Eigene Tab-Mechanik der Projekt-Akte (Teil 1, Punkt 6): spätere
  // Fach-Bausteine (z. B. Energieberater: "Anträge", "Maßnahmen") melden
  // hier künftig ihre eigenen Tabs an -- genauso wie "kontaktTabs" oben.
  projektTabs: [],
};
