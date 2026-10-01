// Rechte-Bereiche, die das Fundament selbst mitbringt (Abschnitt 7: Kontakte,
// Benutzer, Einstellungen, Änderungsprotokoll). Jede App übernimmt diese
// Grundeinstellung in ihrer app.config.js und kann sie dort überschreiben --
// künftige Bausteine melden ihre eigenen Bereiche genauso an.
export const STANDARD_RECHTE_FUNDAMENT = {
  Admin: {
    kontakte: { sehen: true, bearbeiten: true, loeschen: true },
    benutzer: { sehen: true, bearbeiten: true, loeschen: true },
    einstellungen: { sehen: true, bearbeiten: true, loeschen: false },
    protokoll: { sehen: true, bearbeiten: false, loeschen: false },
  },
  Mitarbeiter: {
    kontakte: { sehen: true, bearbeiten: true, loeschen: false },
    benutzer: { sehen: false, bearbeiten: false, loeschen: false },
    einstellungen: { sehen: false, bearbeiten: false, loeschen: false },
    protokoll: { sehen: true, bearbeiten: false, loeschen: false },
  },
  Betrachter: {
    kontakte: { sehen: true, bearbeiten: false, loeschen: false },
    benutzer: { sehen: false, bearbeiten: false, loeschen: false },
    einstellungen: { sehen: false, bearbeiten: false, loeschen: false },
    protokoll: { sehen: true, bearbeiten: false, loeschen: false },
  },
};
