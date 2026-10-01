import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import Card from "../components/Card.jsx";
import Table from "../components/Table.jsx";
import Input from "../components/Input.jsx";
import Button from "../components/Button.jsx";
import Dialog from "../components/Dialog.jsx";
import Message from "../components/Message.jsx";
import Spinner from "../components/Spinner.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { listeKontakte, legeKontaktAn } from "../kontakte/api.js";
import KontaktFormular from "../kontakte/KontaktFormular.jsx";

function anzeigename(k) {
  return [k.vorname, k.nachname].filter(Boolean).join(" ") || "(ohne Namen)";
}

export default function Kontakte() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suche, setSuche] = useState("");
  const [kontakte, setKontakte] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [neuOffen, setNeuOffen] = useState(false);

  function laden(q = suche) {
    listeKontakte(q)
      .then(setKontakte)
      .catch((err) => setFehler(err.message));
  }

  useEffect(() => {
    laden("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sucheAbsenden(e) {
    e.preventDefault();
    laden(suche);
  }

  async function anlegen(daten) {
    const kontakt = await legeKontaktAn(daten);
    setNeuOffen(false);
    navigate(`/kontakte/${kontakt.id}`);
  }

  const darfBearbeiten = !!user?.rechte?.kontakte?.bearbeiten;

  return (
    <div>
      <PageHeader
        title="Kontakte"
        meta={kontakte ? `${kontakte.length} Kontakte` : undefined}
        actions={
          darfBearbeiten && (
            <Button variant="primary" onClick={() => setNeuOffen(true)}>
              Neuer Kontakt
            </Button>
          )
        }
      />

      <Card>
        <form onSubmit={sucheAbsenden} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Input
            placeholder="Suche nach Name, Firma, E-Mail …"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            Suchen
          </Button>
        </form>

        {fehler && <Message type="fehler">{fehler}</Message>}
        {!fehler && kontakte === undefined && <Spinner label="Kontakte werden geladen …" />}
        {!fehler && kontakte !== undefined && (
          <Table
            columns={[
              {
                key: "name",
                label: "Name",
                sortable: true,
                render: (k) => (
                  <button className="btn btn-text" onClick={() => navigate(`/kontakte/${k.id}`)}>
                    {anzeigename(k)}
                  </button>
                ),
              },
              { key: "organisation", label: "Firma / Organisation", sortable: true },
              { key: "email", label: "E-Mail" },
              { key: "telefon", label: "Telefon" },
            ]}
            rows={kontakte}
            rowKey={(k) => k.id}
            emptyText="Keine Kontakte gefunden."
          />
        )}
      </Card>

      <Dialog open={neuOffen} title="Neuer Kontakt" onClose={() => setNeuOffen(false)}>
        <KontaktFormular
          andereKontakte={kontakte || []}
          onSpeichern={anlegen}
          onAbbrechen={() => setNeuOffen(false)}
        />
      </Dialog>
    </div>
  );
}
