// Baustein "Projekte" (Abschnitt 5/12, Teil 1): branchenneutraler Rahmen für
// Projekt-Akten. Phasen-Namen, Status-Liste, Projektarten und die
// Beschriftung des Auftragsdatums kommen aus app.config.js (Feld "projekte"),
// nie fest im Baustein-Code (Abschnitt 8: "Weitere Einstellungen").
export default {
  titel: "Projekte",
  beschreibung: "Projekt-Akten mit Phasen-Leiste, Notizen, Aufgaben und Verlauf.",
  braucht: [],
  menuepunkte: [{ key: "projekte", label: "Projekte", to: "/projekte" }],
  // Menü-Symbol aus dem Symbol-Satz des Fundaments (icons/index.js).
  icon: "IconFolder",
  akteRoute: "/projekte/:id",

  // Abschnitt 7: was die Rolle User in diesem Baustein darf. Admin bekommt
  // beim Freischalten automatisch vollen Zugriff (rechteFuerBausteinAnlegen).
  rechteBereiche: {
    projekte: { sehen: true, bearbeiten: true, loeschen: false },
  },

  // Teil C (Dashboard neu): "Aktive Projekte nach Phase" ist weggefallen,
  // "Zuletzt bearbeitete Projekte" ist zur Kachel "Projekte" geworden (C3).
  kacheln: [{ key: "zuletzt", titel: "Projekte", groesse: "klein", rechtBereich: "projekte" }],

  // Tab "Projekte" auf der Kontakt-Akte (Abschnitt 11/Teil 1, Punkt 7) --
  // Erweiterungspunkt des Fundaments (frontend/Erweiterungen.jsx).
  kontaktTabs: [{ key: "projekte", label: "Projekte" }],

  // Bezeichnung der eigenen Tabellen im Änderungsprotokoll (Kachel "Letzte
  // Aktivitäten", Teil C, Punkt C5) -- das Fundament kennt "projects" nicht
  // selbst. "namensfeld" ist die Spalte mit dem Anzeigenamen des Datensatzes
  // (z. B. 'Projekt „Schulz – Typ B" geändert').
  protokollTabellen: { projects: { titel: "Projekt", namensfeld: "name" } },

  // Eigene Tab-Mechanik der Projekt-Akte (Teil 1, Punkt 6): spätere
  // Fach-Bausteine (z. B. Energieberater: "Anträge", "Maßnahmen") melden
  // hier künftig ihre eigenen Tabs an -- genauso wie "kontaktTabs" oben.
  projektTabs: [],
};
