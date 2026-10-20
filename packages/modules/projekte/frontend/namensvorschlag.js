// Vorschlag für den Projektnamen beim Anlegen (Teil 1, Punkt 3):
// "<Nachname oder Organisation> – <Projektarten> – <Ort>", ohne Ort, falls
// die Objektadresse (noch) keinen hat. Änderbar, nur ein Vorschlag.
export function vorschlagProjektname({ kontakt, arten, objektadresseOrt }) {
  const wer = kontakt?.organisation || kontakt?.nachname || "";
  const teile = [wer, (arten || []).join(" + ")].filter(Boolean);
  if (objektadresseOrt) teile.push(objektadresseOrt);
  return teile.join(" – ");
}
