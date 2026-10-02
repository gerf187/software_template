import { useNavigate } from "react-router-dom";
import EmptyState from "../../components/EmptyState.jsx";

export default function ZuletztBearbeiteteKontakte({ daten }) {
  const navigate = useNavigate();
  const kontakte = daten?.zuletztBearbeiteteKontakte || [];

  if (kontakte.length === 0) return <EmptyState>Noch keine Kontakte bearbeitet.</EmptyState>;

  return (
    <div>
      {kontakte.map((k) => (
        <div
          key={k.id}
          className="table-row-clickable"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "8px 0",
            borderBottom: "1px solid var(--line-soft)",
          }}
          onClick={() => navigate(`/kontakte/${k.id}`)}
        >
          <span>{k.name}</span>
          <small style={{ color: "var(--ink-mute)" }}>
            {new Date(k.zeitpunkt).toLocaleDateString("de-DE")}
          </small>
        </div>
      ))}
    </div>
  );
}
