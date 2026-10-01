import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import Card from "../components/Card.jsx";
import Table from "../components/Table.jsx";
import Badge from "../components/Badge.jsx";
import Spinner from "../components/Spinner.jsx";
import Message from "../components/Message.jsx";

function JaNein({ wert }) {
  return <Badge status={wert ? "success" : "neutral"}>{wert ? "Ja" : "Nein"}</Badge>;
}

export default function Einstellungen() {
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
    <div>
      <PageHeader title="Einstellungen" meta="Wer sieht was" />

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
    </div>
  );
}
