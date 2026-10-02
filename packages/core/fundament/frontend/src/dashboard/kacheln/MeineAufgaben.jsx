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

export default function MeineAufgaben({ daten }) {
  const navigate = useNavigate();
  const aufgaben = daten?.meineAufgaben || [];

  if (aufgaben.length === 0) return <EmptyState>Keine fälligen Aufgaben.</EmptyState>;

  return (
    <div>
      {aufgaben.map((a) => (
        <div
          key={a.id}
          className="table-row-clickable"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "8px 0",
            borderBottom: "1px solid var(--line-soft)",
          }}
          onClick={() => navigate(`/kontakte/${a.kontaktId}`)}
        >
          <span>
            {a.text}
            <br />
            <small style={{ color: "var(--ink-mute)" }}>{a.kontaktName}</small>
          </span>
          <FaelligkeitsBadge faelligAm={a.faelligAm} />
        </div>
      ))}
    </div>
  );
}
