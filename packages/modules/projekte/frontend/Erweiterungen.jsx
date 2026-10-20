import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@fundament/frontend/src/components/Card.jsx";
import Table from "@fundament/frontend/src/components/Table.jsx";
import Badge from "@fundament/frontend/src/components/Badge.jsx";
import Button from "@fundament/frontend/src/components/Button.jsx";
import Dialog from "@fundament/frontend/src/components/Dialog.jsx";
import Spinner from "@fundament/frontend/src/components/Spinner.jsx";
import Message from "@fundament/frontend/src/components/Message.jsx";
import { useAuth } from "@fundament/frontend/src/auth/AuthContext.jsx";
import { listeProjekteVonKontakt, legeProjektAn } from "./api.js";
import ProjektFormular from "./ProjektFormular.jsx";

// Tab "Projekte" auf der Kontakt-Akte (Teil 1, Punkt 7). Baustein aus -> der
// Tab existiert gar nicht mehr (KontaktAkte.jsx fragt nur aktive Bausteine ab),
// die Projekte selbst bleiben erhalten.
function ProjekteTab({ kontaktId, kontakt }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projekte, setProjekte] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [neuOffen, setNeuOffen] = useState(false);

  function laden() {
    listeProjekteVonKontakt(kontaktId)
      .then(setProjekte)
      .catch((err) => setFehler(err.message));
  }
  useEffect(laden, [kontaktId]);

  const darfBearbeiten = !!user?.rechte?.projekte?.bearbeiten;

  async function anlegen(daten) {
    const projekt = await legeProjektAn({ ...daten, contactId: kontaktId });
    setNeuOffen(false);
    navigate(`/projekte/${projekt.id}`);
  }

  return (
    <Card
      title="Projekte"
      actions={
        darfBearbeiten && (
          <Button variant="primary" onClick={() => setNeuOffen(true)}>
            Projekt anlegen
          </Button>
        )
      }
    >
      {fehler && <Message type="fehler">{fehler}</Message>}
      {!fehler && projekte === undefined && <Spinner label="Projekte werden geladen …" />}
      {!fehler && projekte !== undefined && (
        <Table
          columns={[
            { key: "name", label: "Projektname" },
            { key: "phase", label: "Phase" },
            {
              key: "status",
              label: "Status",
              render: (p) => <Badge>{p.status}</Badge>,
            },
            {
              key: "auftragsdatum",
              label: "Auftragsdatum",
              render: (p) => (p.auftragsdatum ? new Date(p.auftragsdatum).toLocaleDateString("de-DE") : "—"),
            },
          ]}
          rows={projekte}
          rowKey={(p) => p.id}
          emptyText="Noch keine Projekte für diesen Kontakt."
          onRowClick={(p) => navigate(`/projekte/${p.id}`)}
        />
      )}

      <Dialog open={neuOffen} title="Projekt anlegen" onClose={() => setNeuOffen(false)} wide>
        <ProjektFormular kontakt={kontakt} onSpeichern={anlegen} onAbbrechen={() => setNeuOffen(false)} />
      </Dialog>
    </Card>
  );
}

export default {
  kontaktTabs: { projekte: ProjekteTab },
};
