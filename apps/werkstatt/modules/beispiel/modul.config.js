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
};
