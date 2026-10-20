import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "@fundament/frontend/src/components/EmptyState.jsx";
import Spinner from "@fundament/frontend/src/components/Spinner.jsx";
import appConfig from "~app-config";
import { listeProjekte, holeZuletztBearbeiteteProjekte } from "./api.js";

const PROJEKTE_CONFIG = appConfig.projekte || { phasen: [], status: [] };
const TERMINALE_STATUS = new Set(PROJEKTE_CONFIG.status.filter((s) => s.terminal).map((s) => s.label));

const ZEILE_STIL = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid var(--line-soft)",
};

// "Aktive Projekte nach Phase" (Teil 1, Punkt 9): Anzahl je Phase, Klick
// filtert die Liste (Seite.jsx liest den "phase"-Parameter beim Laden).
function AktiveProjekteNachPhase() {
  const navigate = useNavigate();
  const [anzahl, setAnzahl] = useState(undefined);

  useEffect(() => {
    listeProjekte({})
      .then((projekte) => {
        const aktive = projekte.filter((p) => !TERMINALE_STATUS.has(p.status));
        const karte = new Map();
        for (const phase of PROJEKTE_CONFIG.phasen) karte.set(phase, 0);
        for (const p of aktive) karte.set(p.phase, (karte.get(p.phase) || 0) + 1);
        setAnzahl(karte);
      })
      .catch(() => setAnzahl(new Map()));
  }, []);

  if (anzahl === undefined) return <Spinner label="Wird geladen …" />;
  if (anzahl.size === 0) return <EmptyState>Keine Projekte.</EmptyState>;

  return (
    <div>
      {[...anzahl.entries()].map(([phase, n]) => (
        <div
          key={phase}
          className="table-row-clickable"
          style={ZEILE_STIL}
          onClick={() => navigate(`/projekte?phase=${encodeURIComponent(phase)}`)}
        >
          <span>{phase}</span>
          <strong>{n}</strong>
        </div>
      ))}
    </div>
  );
}

function ZuletztBearbeiteteProjekte() {
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
          <span>{p.name}</span>
          <small style={{ color: "var(--ink-mute)" }}>{new Date(p.zeitpunkt).toLocaleDateString("de-DE")}</small>
        </div>
      ))}
    </div>
  );
}

export default {
  nachPhase: AktiveProjekteNachPhase,
  zuletzt: ZuletztBearbeiteteProjekte,
};
