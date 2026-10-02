import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import Card from "../components/Card.jsx";
import Table from "../components/Table.jsx";
import Badge from "../components/Badge.jsx";
import Spinner from "../components/Spinner.jsx";
import Message from "../components/Message.jsx";
import Tabs from "../components/Tabs.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import MitarbeiterListe from "../mitarbeiter/MitarbeiterListe.jsx";

function JaNein({ wert }) {
  return <Badge status={wert ? "success" : "neutral"}>{wert ? "Ja" : "Nein"}</Badge>;
}

function RechteMatrix() {
  const [rechte, setRechte] = useState(undefined);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    fetch("/api/rechte")
      .then(async (res) => {
        if (!res.ok) {
          const daten = await res.json().catch(() => ({}));
          throw new Error(daten.error || "Rechte-Matrix konnte nicht geladen werden.");
        }
        return res.json();
      })
      .then(setRechte)
      .catch((err) => setFehler(err.message));
  }, []);

  return (
    <Card title="Wer sieht was">
      {fehler && <Message type="fehler">{fehler}</Message>}
      {!fehler && rechte === undefined && <Spinner label="Rechte werden geladen …" />}
      {!fehler && rechte !== undefined && (
        <Table
          columns={[
            { key: "rolle", label: "Rolle", sortable: true },
            { key: "bereich", label: "Bereich", sortable: true },
            { key: "sehen", label: "Sehen", render: (r) => <JaNein wert={r.sehen} /> },
            { key: "bearbeiten", label: "Bearbeiten", render: (r) => <JaNein wert={r.bearbeiten} /> },
            { key: "loeschen", label: "Löschen", render: (r) => <JaNein wert={r.loeschen} /> },
          ]}
          rows={rechte}
          rowKey={(r) => `${r.rolle}-${r.bereich}`}
          emptyText="Keine Rechte hinterlegt."
        />
      )}
    </Card>
  );
}

export default function Einstellungen() {
  const { user } = useAuth();
  const darfMitarbeiterSehen = !!user?.rechte?.mitarbeiter?.sehen;
  const [tab, setTab] = useState(darfMitarbeiterSehen ? "mitarbeiter" : "rechte");

  const tabs = [];
  if (darfMitarbeiterSehen) tabs.push({ key: "mitarbeiter", label: "Mitarbeiter" });
  tabs.push({ key: "rechte", label: "Wer sieht was" });

  return (
    <div>
      <PageHeader title="Einstellungen" meta={user?.name ? `Firma von ${user.name}` : undefined} />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div style={{ height: 16 }} />

      {tab === "mitarbeiter" && darfMitarbeiterSehen && <MitarbeiterListe />}
      {tab === "rechte" && <RechteMatrix />}
    </div>
  );
}
