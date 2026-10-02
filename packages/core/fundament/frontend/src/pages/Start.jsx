import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import Card from "../components/Card.jsx";
import Badge from "../components/Badge.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Message from "../components/Message.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { ladeDashboard } from "../dashboard/api.js";

function heuteOhneUhrzeit() {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  return heute;
}

// Badge je Fälligkeit (Anhang A.1 Statusfarben): überfällig rot, heute orange,
// später neutral -- noch kein Fristbalken, dafür fehlt eine konkrete Frist.
function FaelligkeitsBadge({ faelligAm }) {
  if (!faelligAm) return null;
  const faellig = new Date(faelligAm);
  const diffTage = Math.round((faellig - heuteOhneUhrzeit()) / 86_400_000);
  const text = faellig.toLocaleDateString("de-DE");

  if (diffTage < 0) return <Badge status="danger">Überfällig · {text}</Badge>;
  if (diffTage === 0) return <Badge status="warn">Heute</Badge>;
  return <Badge status="neutral">{text}</Badge>;
}

function Kennzahl({ titel, wert }) {
  return (
    <Card title={titel}>
      <p style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>{wert}</p>
    </Card>
  );
}

export default function Start() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const darfKontakteSehen = !!user?.rechte?.kontakte?.sehen;
  const [daten, setDaten] = useState(undefined);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    if (!darfKontakteSehen) return;
    ladeDashboard()
      .then(setDaten)
      .catch((err) => setFehler(err.message));
  }, [darfKontakteSehen]);

  return (
    <div>
      <PageHeader title="Start" meta={user?.firma?.name || undefined} />

      {!darfKontakteSehen && <EmptyState>Noch nichts zum Anzeigen.</EmptyState>}

      {darfKontakteSehen && fehler && <Message type="fehler">{fehler}</Message>}
      {darfKontakteSehen && !fehler && daten === undefined && (
        <Spinner label="Wird geladen …" />
      )}

      {darfKontakteSehen && !fehler && daten !== undefined && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Kennzahl titel="Kontakte" wert={daten.anzahlKontakte} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Kennzahl titel="Offene Aufgaben" wert={daten.anzahlOffenerAufgaben} />
            </div>
          </div>

          <Card title="Aufgaben, die Aufmerksamkeit brauchen">
            {daten.aufgaben.length === 0 && <EmptyState>Keine offenen Aufgaben.</EmptyState>}
            {daten.aufgaben.map((a) => (
              <div
                key={a.id}
                className="table-row-clickable"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
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
            {daten.anzahlOffenerAufgaben > daten.aufgaben.length && (
              <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 8 }}>
                Zeigt {daten.aufgaben.length} von {daten.anzahlOffenerAufgaben}.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
