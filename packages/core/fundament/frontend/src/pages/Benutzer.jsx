import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import Card from "../components/Card.jsx";
import Table from "../components/Table.jsx";
import Button from "../components/Button.jsx";
import Dialog from "../components/Dialog.jsx";
import FormField from "../components/FormField.jsx";
import Input from "../components/Input.jsx";
import Select from "../components/Select.jsx";
import Message from "../components/Message.jsx";
import Badge from "../components/Badge.jsx";
import Spinner from "../components/Spinner.jsx";
import Tabs from "../components/Tabs.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  listeBenutzer,
  ladeBenutzerEinladen,
  speichereBenutzer,
  setzeBenutzerAktiv,
} from "../benutzer/api.js";

const ROLLEN = ["Admin", "Mitarbeiter", "Betrachter"];
const LEER = { name: "", email: "", rolle: "Mitarbeiter" };

function werteAusBenutzer(b) {
  return { name: b.name, email: b.email, rolle: b.rolle };
}

function istGleich(a, b) {
  return a.name === b.name && a.email === b.email && a.rolle === b.rolle;
}

export default function Benutzer() {
  const { user } = useAuth();
  const [benutzer, setBenutzer] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [tab, setTab] = useState("aktiv");
  const [ausgewaehlteId, setAusgewaehlteId] = useState(null);
  const [werte, setWerte] = useState(LEER);
  const [ursprung, setUrsprung] = useState(LEER);
  const [speichert, setSpeichert] = useState(false);
  const [wechselZiel, setWechselZiel] = useState(undefined);
  const [archivZiel, setArchivZiel] = useState(null);
  const [startpasswort, setStartpasswort] = useState(null);

  function laden() {
    listeBenutzer().then(setBenutzer).catch((err) => setFehler(err.message));
  }

  useEffect(laden, []);

  const istSchmutzig = !istGleich(werte, ursprung);
  const ausgewaehlterBenutzer = benutzer?.find((b) => b.id === ausgewaehlteId);
  const gefilterte = benutzer?.filter((b) => (tab === "aktiv" ? b.aktiv : !b.aktiv)) || [];

  function wirklichWechseln(ziel) {
    if (ziel === null) {
      setAusgewaehlteId(null);
      setWerte(LEER);
      setUrsprung(LEER);
    } else {
      setAusgewaehlteId(ziel.id);
      setWerte(werteAusBenutzer(ziel));
      setUrsprung(werteAusBenutzer(ziel));
    }
    setFehler(null);
    setStartpasswort(null);
  }

  function zeileKlick(b) {
    if (b.id === ausgewaehlteId) return;
    if (istSchmutzig) {
      setWechselZiel(b);
    } else {
      wirklichWechseln(b);
    }
  }

  function neuerBenutzer() {
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
        const neu = await ladeBenutzerEinladen(werte);
        laden();
        wirklichWechseln(neu);
        setStartpasswort({ email: neu.email, wert: neu.startpasswort });
      } else {
        const aktualisiert = await speichereBenutzer(ausgewaehlteId, werte);
        laden();
        wirklichWechseln(aktualisiert);
      }
    } catch (err) {
      setFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  async function archivierenBestaetigt() {
    const ziel = archivZiel;
    setArchivZiel(null);
    await setzeBenutzerAktiv(ziel.id, false);
    laden();
    if (ziel.id === ausgewaehlteId) wirklichWechseln(null);
  }

  async function reaktivieren(b) {
    await setzeBenutzerAktiv(b.id, true);
    laden();
    if (b.id === ausgewaehlteId) wirklichWechseln(null);
  }

  return (
    <div>
      <PageHeader
        title="Benutzer"
        meta="Deine Firma"
        actions={
          <Button variant="primary" onClick={neuerBenutzer}>
            Benutzer einladen
          </Button>
        }
      />

      <Tabs
        tabs={[
          { key: "aktiv", label: "Aktiv" },
          { key: "archiv", label: "Archiv" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div style={{ height: 16 }} />

      <div className="list-form-split">
        <Card>
          {fehler && <Message type="fehler">{fehler}</Message>}
          {benutzer === undefined && <Spinner label="Benutzer werden geladen …" />}
          {benutzer && (
            <Table
              columns={[
                { key: "name", label: "Name", sortable: true },
                { key: "email", label: "E-Mail" },
                { key: "rolle", label: "Rolle", sortable: true },
                {
                  key: "status",
                  label: "Status",
                  render: (b) => (
                    <Badge status={b.aktiv ? "success" : "neutral"}>
                      {b.aktiv ? "Aktiv" : "Archiviert"}
                    </Badge>
                  ),
                },
                {
                  key: "aktionen",
                  label: "",
                  render: (b) =>
                    b.aktiv ? (
                      <Button
                        variant="secondary"
                        disabled={b.id === user?.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setArchivZiel(b);
                        }}
                      >
                        Archivieren
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          reaktivieren(b);
                        }}
                      >
                        Reaktivieren
                      </Button>
                    ),
                },
              ]}
              rows={gefilterte}
              rowKey={(b) => b.id}
              emptyText={tab === "aktiv" ? "Keine aktiven Benutzer." : "Niemand archiviert."}
              onRowClick={zeileKlick}
              selectedRowKey={ausgewaehlteId}
            />
          )}
        </Card>

        <div>
          <Card title={ausgewaehlteId === null ? "Benutzer einladen" : "Benutzer bearbeiten"}>
            {startpasswort && (
              <Message type="erfolg">
                Angelegt: {startpasswort.email}. Startpasswort (einmalig, bitte sicher übermitteln):{" "}
                <strong>{startpasswort.wert}</strong> — muss beim ersten Login geändert werden.
              </Message>
            )}
            <form onSubmit={speichern}>
              <FormField label="Name" htmlFor="benutzer-name">
                <Input
                  id="benutzer-name"
                  value={werte.name}
                  onChange={(e) => setWerte((w) => ({ ...w, name: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="E-Mail" htmlFor="benutzer-email">
                <Input
                  id="benutzer-email"
                  type="email"
                  value={werte.email}
                  onChange={(e) => setWerte((w) => ({ ...w, email: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Rolle" htmlFor="benutzer-rolle">
                <Select
                  id="benutzer-rolle"
                  value={werte.rolle}
                  disabled={ausgewaehlteId === user?.id}
                  onChange={(e) => setWerte((w) => ({ ...w, rolle: e.target.value }))}
                >
                  {ROLLEN.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                {ausgewaehlteId !== null && (
                  <Button type="button" variant="text" onClick={neuerBenutzer}>
                    Abbrechen
                  </Button>
                )}
                <Button type="submit" variant="primary" loading={speichert}>
                  {ausgewaehlteId === null ? "Einladen" : "Speichern"}
                </Button>
              </div>
            </form>
          </Card>
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
        Dieser Benutzer hat noch ungespeicherte Änderungen im Formular. Wenn du wechselst, gehen sie
        verloren.
      </Dialog>

      <Dialog
        open={archivZiel !== null}
        title="Benutzer archivieren?"
        onClose={() => setArchivZiel(null)}
        actions={
          <>
            <Button variant="text" onClick={() => setArchivZiel(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={archivierenBestaetigt}>
              Archivieren
            </Button>
          </>
        }
      >
        {archivZiel?.name} kann sich danach nicht mehr anmelden. Die Daten bleiben erhalten, im
        Reiter „Archiv" lässt sich der Benutzer jederzeit wieder reaktivieren.
      </Dialog>
    </div>
  );
}
