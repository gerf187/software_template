import EmptyState from "../../components/EmptyState.jsx";

const TABELLE_TEXT = { contacts: "Kontakt", notes: "Notiz", tasks: "Aufgabe" };
const AKTION_TEXT = { angelegt: "angelegt", geaendert: "geändert", geloescht: "gelöscht" };

export default function LetzteAktivitaeten({ daten }) {
  const eintraege = daten?.letzteAktivitaeten || [];

  if (eintraege.length === 0) return <EmptyState>Noch keine Änderungen protokolliert.</EmptyState>;

  return (
    <div>
      {eintraege.map((e) => (
        <p key={e.id} style={{ margin: "0 0 8px" }}>
          {TABELLE_TEXT[e.tabelle] || e.tabelle} {AKTION_TEXT[e.aktion] || e.aktion} am{" "}
          {new Date(e.zeitpunkt).toLocaleString("de-DE")}
          {e.benutzerName ? ` von ${e.benutzerName}` : ""}
        </p>
      ))}
    </div>
  );
}
