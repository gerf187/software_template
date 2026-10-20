// Kürzel (Slug) wird aus dem Firmennamen erzeugt, kein eigenes Formularfeld
// (Abschnitt 7: Firma anlegen).
const UMLAUTE = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };

export function erzeugeSlugAusName(name) {
  const ohneUmlaute = String(name).replace(/[äöüÄÖÜß]/g, (z) => UMLAUTE[z]);
  return ohneUmlaute
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
