import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import Card from "../components/Card.jsx";
import Zugangsdaten from "../components/Zugangsdaten.jsx";
import Table from "../components/Table.jsx";
import Button from "../components/Button.jsx";
import Dialog from "../components/Dialog.jsx";
import FormField from "../components/FormField.jsx";
import Input from "../components/Input.jsx";
import Checkbox from "../components/Checkbox.jsx";
import Message from "../components/Message.jsx";
import Badge from "../components/Badge.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import {
  listeFirmen,
  legeFirmaAn,
  speichereFirma,
  setzeFirmaAktiv,
  ladeFirmaEinladen,
  listeModule,
  setzeModulAktiv,
} from "../superadmin/api.js";

const LEER = { name: "", slug: "", aktiv: true };

function werteAusFirma(firma) {
  return { name: firma.name, slug: firma.slug, aktiv: firma.aktiv };
}

function istGleich(a, b) {
  return a.name === b.name && a.slug === b.slug && a.aktiv === b.aktiv;
}

function EinladenKarte({ firmaId }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ergebnis, setErgebnis] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [speichert, setSpeichert] = useState(false);

  async function absenden(e) {
    e.preventDefault();
    setSpeichert(true);
    setFehler(null);
    try {
      const daten = await ladeFirmaEinladen(firmaId, { email, name });
      setErgebnis(daten);
      setEmail("");
      setName("");
    } catch (err) {
      setFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <Card title="Firmen-Admin einladen">
      {fehler && <Message type="fehler">{fehler}</Message>}
      {ergebnis && (
        <Zugangsdaten
          email={ergebnis.email}
          startpasswort={ergebnis.startpasswort}
          onAusblenden={() => setErgebnis(null)}
        />
      )}
      <form onSubmit={absenden}>
        <FormField label="Name" htmlFor="einladen-name">
          <Input id="einladen-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        <FormField label="E-Mail" htmlFor="einladen-email">
          <Input
            id="einladen-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <Button type="submit" variant="primary" loading={speichert}>
          Einladen
        </Button>
      </form>
    </Card>
  );
}

function BausteineKarte({ firmaId }) {
  const [module, setModule] = useState(undefined);
  const [fehler, setFehler] = useState(null);

  function laden() {
    listeModule(firmaId)
      .then(setModule)
      .catch((err) => setFehler(err.message));
  }

  useEffect(laden, [firmaId]);

  async function umschalten(modul, aktiv) {
    setFehler(null);
    try {
      await setzeModulAktiv(firmaId, modul, aktiv);
      laden();
    } catch (err) {
      setFehler(err.message);
      laden();
    }
  }

  return (
    <Card title="Bausteine">
      {fehler && <Message type="fehler">{fehler}</Message>}
      <p>
        <Checkbox label="Fundament (immer dabei)" checked disabled />
      </p>
      {module === undefined && <Spinner label="Bausteine werden geladen …" />}
      {module?.length === 0 && <EmptyState>Diese App bietet noch keine Bausteine an.</EmptyState>}
      {module?.map((m) => (
        <p key={m.name}>
          <Checkbox
            label={`${m.titel}${m.braucht.length ? ` (braucht: ${m.braucht.join(", ")})` : ""}`}
            checked={m.aktiv}
            onChange={(e) => umschalten(m.name, e.target.checked)}
          />
          {m.beschreibung && (
            <small style={{ display: "block", marginLeft: 28, color: "var(--ink-mute)" }}>
              {m.beschreibung}
            </small>
          )}
        </p>
      ))}
    </Card>
  );
}

export default function SuperadminFirmen() {
  const [firmen, setFirmen] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [ausgewaehlteId, setAusgewaehlteId] = useState(null);
  const [werte, setWerte] = useState(LEER);
  const [ursprung, setUrsprung] = useState(LEER);
  const [speichert, setSpeichert] = useState(false);
  const [wechselZiel, setWechselZiel] = useState(undefined);

  function laden() {
    listeFirmen().then(setFirmen).catch((err) => setFehler(err.message));
  }

  useEffect(laden, []);

  const istSchmutzig = !istGleich(werte, ursprung);
  const ausgewaehlteFirma = firmen?.find((f) => f.id === ausgewaehlteId);

  function wirklichWechseln(ziel) {
    if (ziel === null) {
      setAusgewaehlteId(null);
      setWerte(LEER);
      setUrsprung(LEER);
    } else {
      setAusgewaehlteId(ziel.id);
      setWerte(werteAusFirma(ziel));
      setUrsprung(werteAusFirma(ziel));
    }
    setFehler(null);
  }

  function zeileKlick(firma) {
    if (firma.id === ausgewaehlteId) return;
    if (istSchmutzig) {
      setWechselZiel(firma);
    } else {
      wirklichWechseln(firma);
    }
  }

  function neueFirma() {
    if (ausgewaehlteId === null) return;
    if (istSchmutzig) {
      setWechselZiel(null);
    } else {
      wirklichWechseln(null);
    }
  }

  async function speichern(e) {
    e.preventDefault();
    setSpeichert(true);
    setFehler(null);
    try {
      if (ausgewaehlteId === null) {
        const neu = await legeFirmaAn(werte);
        laden();
        wirklichWechseln(neu);
      } else {
        const aktualisiert = await speichereFirma(ausgewaehlteId, werte);
        laden();
        wirklichWechseln(aktualisiert);
      }
    } catch (err) {
      setFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  async function sperrenUmschalten(firma) {
    await setzeFirmaAktiv(firma.id, !firma.aktiv);
    laden();
    if (firma.id === ausgewaehlteId) {
      setWerte((w) => ({ ...w, aktiv: !firma.aktiv }));
      setUrsprung((u) => ({ ...u, aktiv: !firma.aktiv }));
    }
  }

  return (
    <div>
      <PageHeader
        title="Firmen"
        meta="Superadmin"
        actions={
          <Button variant="primary" onClick={neueFirma}>
            Neue Firma
          </Button>
        }
      />

      <div className="list-form-split">
        <Card>
          {fehler && <Message type="fehler">{fehler}</Message>}
          {firmen === undefined && <Spinner label="Firmen werden geladen …" />}
          {firmen && (
            <Table
              columns={[
                { key: "name", label: "Name", sortable: true },
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
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        sperrenUmschalten(f);
                      }}
                    >
                      {f.aktiv ? "Sperren" : "Entsperren"}
                    </Button>
                  ),
                },
              ]}
              rows={firmen}
              rowKey={(f) => f.id}
              emptyText="Noch keine Firmen angelegt."
              onRowClick={zeileKlick}
              selectedRowKey={ausgewaehlteId}
            />
          )}
        </Card>

        <div>
          <Card title={ausgewaehlteId === null ? "Neue Firma" : "Firma bearbeiten"}>
            <form onSubmit={speichern}>
              <FormField label="Name" htmlFor="firma-name">
                <Input
                  id="firma-name"
                  value={werte.name}
                  onChange={(e) => setWerte((w) => ({ ...w, name: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Kürzel (Slug)" htmlFor="firma-slug">
                <Input
                  id="firma-slug"
                  value={werte.slug}
                  onChange={(e) => setWerte((w) => ({ ...w, slug: e.target.value }))}
                  required
                />
              </FormField>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                {ausgewaehlteId !== null && (
                  <Button type="button" variant="text" onClick={neueFirma}>
                    Abbrechen
                  </Button>
                )}
                <Button type="submit" variant="primary" loading={speichert}>
                  Speichern
                </Button>
              </div>
            </form>
          </Card>

          {ausgewaehlteFirma && (
            <>
              <div style={{ height: 24 }} />
              <EinladenKarte firmaId={ausgewaehlteFirma.id} />
              <div style={{ height: 24 }} />
              <BausteineKarte firmaId={ausgewaehlteFirma.id} />
            </>
          )}
        </div>
      </div>

      <Dialog
        open={wechselZiel !== undefined}
        title="Ungespeicherte Änderungen verwerfen?"
        onClose={() => setWechselZiel(undefined)}
        actions={
          <>
            <Button variant="text" onClick={() => setWechselZiel(undefined)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                wirklichWechseln(wechselZiel);
                setWechselZiel(undefined);
              }}
            >
              Verwerfen
            </Button>
          </>
        }
      >
        Diese Firma hat noch ungespeicherte Änderungen im Formular. Wenn du wechselst,
        gehen sie verloren.
      </Dialog>
    </div>
  );
}
