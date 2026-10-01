// Reine Funktion ohne Datenbankzugriff, damit "Abhängigkeit verhindert
// Einschalten" (Abschnitt 8) einfach zu testen ist.
export function fehlendeAbhaengigkeiten(braucht, aktiveModule) {
  return (braucht || []).filter((b) => !aktiveModule.has(b));
}
