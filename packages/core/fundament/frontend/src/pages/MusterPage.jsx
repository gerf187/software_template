import { useState } from "react";
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  FormField,
  Card,
  Table,
  Badge,
  Dialog,
  Tabs,
  Message,
  Spinner,
  EmptyState,
  PageHeader,
  PhaseBar,
  DeadlineBar,
} from "../components/index.js";

const sampleRows = [
  { id: 1, name: "Firma Sonne GmbH", ort: "Köln", status: "aktiv" },
  { id: 2, name: "Musterbau AG", ort: "Bonn", status: "gesperrt" },
];

export default function MusterPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState("a");

  return (
    <div>
      <PageHeader
        title="Muster"
        meta="Nur intern"
        actions={<Button variant="primary">Aktion</Button>}
      />

      <Card title="Buttons">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="primary">Primär</Button>
          <Button variant="secondary">Sekundär</Button>
          <Button variant="danger">Gefahr</Button>
          <Button variant="text">Abbrechen</Button>
          <Button variant="text-danger">Löschen</Button>
          <Button variant="primary" disabled>
            Deaktiviert
          </Button>
          <Button variant="primary" loading>
            Speichern
          </Button>
        </div>
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Formularfelder">
        <FormField label="Name" htmlFor="muster-name">
          <Input id="muster-name" placeholder="z. B. Björn Esser" />
        </FormField>
        <FormField label="Notiz" htmlFor="muster-notiz" error="Pflichtfeld">
          <Textarea id="muster-notiz" />
        </FormField>
        <FormField label="Rolle" htmlFor="muster-rolle">
          <Select id="muster-rolle">
            <option>Admin</option>
            <option>Mitarbeiter</option>
          </Select>
        </FormField>
        <Checkbox label="Aktiv" defaultChecked />
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Tabelle">
        <Table
          columns={[
            { key: "name", label: "Name", sortable: true },
            { key: "ort", label: "Ort", sortable: true },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge status={row.status === "aktiv" ? "success" : "danger"}>
                  {row.status}
                </Badge>
              ),
            },
          ]}
          rows={sampleRows}
          rowKey={(row) => row.id}
        />
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Leere Tabelle">
        <Table columns={[{ key: "name", label: "Name" }]} rows={[]} rowKey={(r) => r.id} />
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Badges">
        <div style={{ display: "flex", gap: 8 }}>
          <Badge status="success">Erfolg</Badge>
          <Badge status="warn">Warnung</Badge>
          <Badge status="danger">Gefahr</Badge>
          <Badge status="info">Info</Badge>
          <Badge status="neutral">Neutral</Badge>
          <Badge status="success" pill>
            Pille
          </Badge>
        </div>
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Meldungen">
        <Message type="erfolg">Erfolgreich gespeichert.</Message>
        <Message type="fehler">E-Mail oder Passwort falsch.</Message>
        <Message type="hinweis">Bitte Angaben prüfen.</Message>
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Ladeanzeige & Leerzustand">
        <Spinner />
        <div style={{ height: 16 }} />
        <EmptyState>Keine Kontakte gefunden.</EmptyState>
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Dialog">
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          Dialog öffnen
        </Button>
        <Dialog
          open={dialogOpen}
          title="Wirklich löschen?"
          onClose={() => setDialogOpen(false)}
          actions={
            <>
              <Button variant="text" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={() => setDialogOpen(false)}>
                Löschen
              </Button>
            </>
          }
        >
          Dieser Vorgang kann nicht rückgängig gemacht werden.
        </Dialog>
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Tabs">
        <Tabs
          tabs={[
            { key: "a", label: "Übersicht" },
            { key: "b", label: "Verlauf" },
          ]}
          active={tab}
          onChange={setTab}
        />
        <p>Inhalt von Tab „{tab}".</p>
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Phasen-Leiste">
        <PhaseBar
          phases={["Anfrage", "Angebot", "Beauftragt", "In Arbeit", "Abgeschlossen"]}
          active="Beauftragt"
        />
      </Card>

      <div style={{ height: 24 }} />

      <Card title="Fristbalken">
        <DeadlineBar percent={30} />
        <div style={{ height: 8 }} />
        <DeadlineBar percent={70} />
        <div style={{ height: 8 }} />
        <DeadlineBar percent={95} />
      </Card>
    </div>
  );
}
