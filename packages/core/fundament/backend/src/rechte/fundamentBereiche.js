// Rechte-Bereiche, die das Fundament selbst mitbringt (Abschnitt 7: Kontakte,
// Mitarbeiter, Einstellungen, Änderungsprotokoll). Jede App übernimmt diese
// Grundeinstellung in ihrer app.config.js und kann sie dort überschreiben --
// künftige Bausteine melden ihre eigenen Bereiche genauso an.
//
// Nur zwei Rollen pro Firma (Stand 2026-10-02, Björns Entscheidung): Admin
// (Chef, sieht/verwaltet alles inkl. Mitarbeiter) und User (normaler
// Mitarbeiter). Keine Betrachter-Rolle -- externe Einsicht läuft künftig über
// ein eigenes Kundenportal, nicht über eine interne Rolle.
export const STANDARD_RECHTE_FUNDAMENT = {
  Admin: {
    kontakte: { sehen: true, bearbeiten: true, loeschen: true },
    mitarbeiter: { sehen: true, bearbeiten: true, loeschen: true },
    einstellungen: { sehen: true, bearbeiten: true, loeschen: false },
    protokoll: { sehen: true, bearbeiten: false, loeschen: false },
  },
  User: {
    kontakte: { sehen: true, bearbeiten: true, loeschen: false },
    mitarbeiter: { sehen: false, bearbeiten: false, loeschen: false },
    einstellungen: { sehen: false, bearbeiten: false, loeschen: false },
    protokoll: { sehen: false, bearbeiten: false, loeschen: false },
  },
};
