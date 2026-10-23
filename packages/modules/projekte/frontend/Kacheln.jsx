import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "@fundament/frontend/src/components/EmptyState.jsx";
import Spinner from "@fundament/frontend/src/components/Spinner.jsx";
import { holeZuletztBearbeiteteProjekte } from "./api.js";
import ProjektStatusBadge from "./ProjektStatusBadge.jsx";

const ZEILE_STIL = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid var(--line-soft)",
};

// Dashboard-Kachel "Projekte" (Teil C, Punkt C3): 5 zuletzt bearbeitete
// Projekte, neueste oben. Zeile öffnet die Akte, Link unten führt zur
// vollen Liste.
function Projekte() {
  const navigate = useNavigate();
  const [projekte, setProjekte] = useState(undefined);

  useEffect(() => {
    holeZuletztBearbeiteteProjekte()
      .then(setProjekte)
      .catch(() => setProjekte([]));
  }, []);

  if (projekte === undefined) return <Spinner label="Wird geladen …" />;
  if (projekte.length === 0) return <EmptyState>Noch keine Projekte bearbeitet.</EmptyState>;

  return (
    <div>
      {projekte.map((p) => (
        <div
          key={p.id}
          className="table-row-clickable"
          style={ZEILE_STIL}
          onClick={() => navigate(`/projekte/${p.id}`)}
        >
          <span>
            {p.name}
            <br />
            <small style={{ color: "var(--ink-mute)" }}>{p.kontaktName}</small>
          </span>
          <span style={{ textAlign: "right" }}>
            <small style={{ display: "block", color: "var(--ink-mute)" }}>{p.phase}</small>
            <ProjektStatusBadge status={p.status} />
            <br />
            <small style={{ color: "var(--ink-mute)" }}>
              {new Date(p.zeitpunkt).toLocaleString("de-DE")}
            </small>
          </span>
        </div>
      ))}
      <div style={{ marginTop: 8, textAlign: "right" }}>
        <a href="/projekte" onClick={(e) => { e.preventDefault(); navigate("/projekte"); }}>
          Alle Projekte →
        </a>
      </div>
    </div>
  );
}

export default {
  zuletzt: Projekte,
};
