function tageszeit() {
  const stunde = new Date().getHours();
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

// C1: zusätzlich zur Begrüßung "X Aufgaben heute fällig, Y überfällig" --
// nur, wenn der Benutzer das Recht "kontakte sehen" hat (sonst liefert das
// Backend diese Zähler gar nicht erst mit, siehe dashboard/routes.js).
function aufgabenSatz(daten) {
  if (daten?.aufgabenHeute === undefined) return null;
  const heute = daten.aufgabenHeute;
  const ueberfaellig = daten.aufgabenUeberfaellig;
  return `${heute} Aufgabe${heute === 1 ? "" : "n"} heute fällig, ${ueberfaellig} überfällig`;
}

export default function Begruessung({ user, daten }) {
  const datum = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const satz = aufgabenSatz(daten);
  return (
    <p style={{ margin: 0 }}>
      {tageszeit()}{user?.name ? `, ${user.name}` : ""}.
      <br />
      <span style={{ color: "var(--ink-mute)" }}>{datum}</span>
      {satz && (
        <>
          <br />
          {/* Rot/Grün heißt schlecht/gut (Abschnitt 9, Regel 2): mehr
              überfällige Aufgaben = schlecht, auch wenn die Zahl steigt. */}
          <span style={{ color: daten.aufgabenUeberfaellig > 0 ? "var(--danger)" : "var(--ink-mute)" }}>
            {satz}
          </span>
        </>
      )}
    </p>
  );
}
