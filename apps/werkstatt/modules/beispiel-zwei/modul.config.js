// Zweiter winziger Test-Baustein -- bringt keine eigene Seite mit, sondern
// dient nur dazu, die Abhängigkeitsprüfung ("braucht") im Modul-System zu
// testen und in der Werkstatt vorzuführen (Abschnitt 8).
export default {
  titel: "Beispiel Zwei",
  beschreibung: "Braucht den Baustein 'Beispiel' -- zeigt, dass Abhängigkeiten geprüft werden.",
  braucht: ["beispiel"],
  menuepunkte: [],
};
