import { useNavigate } from "react-router-dom";
import Badge from "../../components/Badge.jsx";
import EmptyState from "../../components/EmptyState.jsx";

function heuteOhneUhrzeit() {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  return heute;
}

function FaelligkeitsBadge({ faelligAm }) {
  const faellig = new Date(faelligAm);
  const text = faellig.toLocaleDateString("de-DE");
  if (faellig < heuteOhneUhrzeit()) return <Badge status="danger">Überfällig · {text}</Badge>;
  return <Badge status="warn">Heute</Badge>;
}

// C2: Spalten Aufgabe · Kontakt · Projekt · Fällig. "Projekt" kommt vom
// Baustein "Projekte" über einen Erweiterungspunkt (siehe
// dashboard/routes.js) -- ohne aktiven Baustein oder ohne Projektbezug der
// Aufgabe bleibt die Spalte leer ("–").
export default function MeineAufgaben({ daten }) {
  const navigate = useNavigate();
  const aufgaben = daten?.meineAufgaben || [];

  if (aufgaben.length === 0) return <EmptyState>Keine fälligen Aufgaben.</EmptyState>;

  return (
    <div className="meine-aufgaben">
      <div className="meine-aufgaben-zeile meine-aufgaben-kopf">
        <span>Aufgabe</span>
        <span>Kontakt</span>
        <span className="meine-aufgaben-projekt">Projekt</span>
        <span>Fällig</span>
      </div>
      {aufgaben.map((a) => (
        <div
          key={a.id}
          className="meine-aufgaben-zeile table-row-clickable"
          onClick={() => navigate(`/kontakte/${a.kontaktId}`)}
        >
          <span>{a.text}</span>
          <span>{a.kontaktName}</span>
          <span className="meine-aufgaben-projekt">
            {a.projekt ? (
              <a
                href={a.projekt.to}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(a.projekt.to);
                }}
              >
                {a.projekt.name}
              </a>
            ) : (
              "–"
            )}
          </span>
          <span>
            <FaelligkeitsBadge faelligAm={a.faelligAm} />
          </span>
        </div>
      ))}
    </div>
  );
}
