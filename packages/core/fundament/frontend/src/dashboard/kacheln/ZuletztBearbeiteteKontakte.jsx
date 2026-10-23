import { useNavigate } from "react-router-dom";
import EmptyState from "../../components/EmptyState.jsx";

// Kachel "Kontakte" (Teil C, Punkt C4): 5 zuletzt bearbeitete, neueste oben.
// Name (Firma klein darunter) · E-Mail · Telefon ("–" bei leer). Zeile öffnet
// den Kontakt, Link unten führt zur vollen Liste.
export default function ZuletztBearbeiteteKontakte({ daten }) {
  const navigate = useNavigate();
  const kontakte = daten?.zuletztBearbeiteteKontakte || [];

  if (kontakte.length === 0) return <EmptyState>Noch keine Kontakte bearbeitet.</EmptyState>;

  return (
    <div>
      {kontakte.map((k) => (
        <div
          key={k.id}
          className="table-row-clickable zuletzt-kontakte-zeile"
          onClick={() => navigate(`/kontakte/${k.id}`)}
        >
          <span>
            {k.name}
            {k.firma && (
              <>
                <br />
                <small style={{ color: "var(--ink-mute)" }}>{k.firma}</small>
              </>
            )}
          </span>
          <span className="zuletzt-kontakte-email">{k.email || "–"}</span>
          <span className="zuletzt-kontakte-telefon">{k.telefon || "–"}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, textAlign: "right" }}>
        <a href="/kontakte" onClick={(e) => { e.preventDefault(); navigate("/kontakte"); }}>
          Alle Kontakte →
        </a>
      </div>
    </div>
  );
}
