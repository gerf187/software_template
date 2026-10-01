import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import Card from "../components/Card.jsx";
import Table from "../components/Table.jsx";
import Button from "../components/Button.jsx";
import Dialog from "../components/Dialog.jsx";
import FormField from "../components/FormField.jsx";
import Input from "../components/Input.jsx";
import Message from "../components/Message.jsx";
import Badge from "../components/Badge.jsx";
import Spinner from "../components/Spinner.jsx";
import { listeFirmen, legeFirmaAn, setzeFirmaAktiv } from "../superadmin/api.js";

export default function SuperadminFirmen() {
  const navigate = useNavigate();
  const [firmen, setFirmen] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [neuOffen, setNeuOffen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [speichert, setSpeichert] = useState(false);

  function laden() {
    listeFirmen().then(setFirmen).catch((err) => setFehler(err.message));
  }

  useEffect(laden, []);

  async function anlegen(e) {
    e.preventDefault();
    setSpeichert(true);
    setFehler(null);
    try {
      await legeFirmaAn({ name, slug });
      setNeuOffen(false);
      setName("");
      setSlug("");
      laden();
    } catch (err) {
      setFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  async function sperrenUmschalten(firma) {
    await setzeFirmaAktiv(firma.id, !firma.aktiv);
    laden();
  }

  return (
    <div>
      <PageHeader
        title="Firmen"
        meta="Superadmin"
        actions={
          <Button variant="primary" onClick={() => setNeuOffen(true)}>
            Neue Firma
          </Button>
        }
      />

      <Card>
        {fehler && <Message type="fehler">{fehler}</Message>}
        {firmen === undefined && <Spinner label="Firmen werden geladen …" />}
        {firmen && (
          <Table
            columns={[
              {
                key: "name",
                label: "Name",
                sortable: true,
                render: (f) => (
                  <button
                    className="btn btn-text"
                    onClick={() => navigate(`/superadmin/firmen/${f.id}`)}
                  >
                    {f.name}
                  </button>
                ),
              },
              { key: "slug", label: "Kürzel" },
              {
                key: "aktiv",
                label: "Status",
                render: (f) => (
                  <Badge status={f.aktiv ? "success" : "danger"}>
                    {f.aktiv ? "Aktiv" : "Gesperrt"}
                  </Badge>
                ),
              },
              {
                key: "aktionen",
                label: "",
                render: (f) => (
                  <Button variant="secondary" onClick={() => sperrenUmschalten(f)}>
                    {f.aktiv ? "Sperren" : "Entsperren"}
                  </Button>
                ),
              },
            ]}
            rows={firmen}
            rowKey={(f) => f.id}
            emptyText="Noch keine Firmen angelegt."
          />
        )}
      </Card>

      <Dialog open={neuOffen} title="Neue Firma anlegen" onClose={() => setNeuOffen(false)}>
        <form onSubmit={anlegen}>
          <FormField label="Name" htmlFor="firma-name">
            <Input id="firma-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="Kürzel (Slug)" htmlFor="firma-slug">
            <Input id="firma-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <Button type="button" variant="text" onClick={() => setNeuOffen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary" loading={speichert}>
              Anlegen
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
