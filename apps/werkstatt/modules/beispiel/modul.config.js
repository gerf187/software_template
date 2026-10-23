// Winziger Test-Baustein, nur um das Ein-/Ausschalten von Bausteinen in der
// Werkstatt auszuprobieren (Abschnitt 8, Abschnitt 12). Keine Fachlogik.
export default {
  titel: "Beispiel",
  beschreibung: "Testbaustein zum Ein- und Ausschalten -- zeigt nur eine Seite 'Hallo Baustein'.",
  braucht: [],
  menuepunkte: [{ key: "beispiel", label: "Beispiel", to: "/beispiel" }],
  // Meldet sein eigenes Recht an (Abschnitt 8): legt fest, was die Rolle User
  // hier darf. Admin bekommt beim Freischalten automatisch vollen Zugriff.
  rechteBereiche: {
    beispiel: { sehen: true, bearbeiten: false, loeschen: false },
  },
  // Meldet eine Dashboard-Kachel an (Abschnitt 8/10). Nutzt dasselbe Recht
  // wie die Seite -- kein eigener Rechte-Bereich nur für die Kachel nötig.
  // standardSichtbar: false (Teil C) -- steht nicht automatisch auf dem
  // Dashboard, lässt sich aber im Anpassen-Modus jederzeit einschalten.
  // Tests brauchen weiterhin, dass es sie überhaupt gibt.
  kacheln: [
    { key: "beispiel", titel: "Beispiel", groesse: "klein", rechtBereich: "beispiel", standardSichtbar: false },
  ],
};
