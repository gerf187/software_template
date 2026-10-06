import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Zugangsdaten from "../components/Zugangsdaten.jsx";
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
  listeMitarbeiter,
  ladeMitarbeiterEinladen,
  speichereMitarbeiter,
  setzeMitarbeiterAktiv,
  loescheMitarbeiterEndgueltig,
} from "./api.js";

const ROLLEN = ["Admin", "User"];
const LEER = { name: "", email: "", rolle: "User" };

export default function MitarbeiterListe() {
  const { user } = useAuth();
  const [mitarbeiter, setMitarbeiter] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [tab, setTab] = useState("aktiv");
  const [formular, setFormular] = useState(null); // null | { id: number|null, werte }
  const [formFehler, setFormFehler] = useState(null);
  const [speichert, setSpeichert] = useState(false);
  const [archivZiel, setArchivZiel] = useState(null);
  const [loeschZiel, setLoeschZiel] = useState(null);
  const [loeschFehler, setLoeschFehler] = useState(null);
  const [startpasswort, setStartpasswort] = useState(null);

  function laden() {
    listeMitarbeiter().then(setMitarbeiter).catch((err) => setFehler(err.message));
  }

  useEffect(laden, []);

  const gefilterte = mitarbeiter?.filter((m) => (tab === "aktiv" ? m.aktiv : !m.aktiv)) || [];

  function oeffneNeu() {
    setFormFehler(null);
    setFormular({ id: null, werte: LEER });
  }

  function oeffneBearbeiten(m) {
    setFormFehler(null);
    setFormular({ id: m.id, werte: { name: m.name, email: m.email, rolle: m.rolle } });
  }

  async function speichern(e) {
    e.preventDefault();
    setSpeichert(true);
    setFormFehler(null);
    try {
      if (formular.id === null) {
        const neu = await ladeMitarbeiterEinladen(formular.werte);
        setFormular(null);
        laden();
        setStartpasswort({ email: neu.email, wert: neu.startpasswort });
      } else {
        await speichereMitarbeiter(formular.id, formular.werte);
        setFormular(null);
        laden();
      }
    } catch (err) {
      setFormFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  async function archivierenBestaetigt() {
    const ziel = archivZiel;
    setArchivZiel(null);
    await setzeMitarbeiterAktiv(ziel.id, false);
    laden();
  }

  async function reaktivieren(m) {
    await setzeMitarbeiterAktiv(m.id, true);
    laden();
  }

  async function endgueltigLoeschenBestaetigt() {
    const ziel = loeschZiel;
    setLoeschFehler(null);
    try {
      await loescheMitarbeiterEndgueltig(ziel.id);
      setLoeschZiel(null);
      laden();
    } catch (err) {
      setLoeschFehler(err.message);
    }
  }

  return (
    <div>
      {startpasswort && (
        <Zugangsdaten
          email={startpasswort.email}
          startpasswort={startpasswort.wert}
          onAusblenden={() => setStartpasswort(null)}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Tabs
          tabs={[
            { key: "aktiv", label: "Aktiv" },
            { key: "archiv", label: "Archiv" },
          ]}
          active={tab}
          onChange={setTab}
        />
        <Button variant="primary" onClick={oeffneNeu}>
          Mitarbeiter einladen
        </Button>
      </div>

      <Card>
        {fehler && <Message type="fehler">{fehler}</Message>}
        {mitarbeiter === undefined && <Spinner label="Mitarbeiter werden geladen …" />}
        {mitarbeiter && (
          <Table
            columns={[
              { key: "name", label: "Name", sortable: true },
              { key: "email", label: "E-Mail" },
              { key: "rolle", label: "Rolle", sortable: true },
              {
                key: "status",
                label: "Status",
                render: (m) => (
                  <Badge status={m.aktiv ? "success" : "neutral"}>
                    {m.aktiv ? "Aktiv" : "Archiviert"}
                  </Badge>
                ),
              },
              {
                key: "aktionen",
                label: "",
                render: (m) =>
                  m.aktiv ? (
                    <Button
                      variant="secondary"
                      disabled={m.id === user?.id}
                      onClick={() => setArchivZiel(m)}
                    >
                      Archivieren
                    </Button>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button variant="secondary" onClick={() => reaktivieren(m)}>
                        Reaktivieren
                      </Button>
                      <Button variant="text" onClick={() => setLoeschZiel(m)}>
                        Endgültig löschen
                      </Button>
                    </div>
                  ),
              },
            ]}
            rows={gefilterte}
            rowKey={(m) => m.id}
            emptyText={tab === "aktiv" ? "Keine aktiven Mitarbeiter." : "Niemand archiviert."}
            onRowClick={oeffneBearbeiten}
          />
        )}
      </Card>

      <Dialog
        open={formular !== null}
        title={formular?.id === null ? "Mitarbeiter einladen" : "Mitarbeiter bearbeiten"}
        onClose={() => setFormular(null)}
        actions={
          <>
            <Button variant="text" onClick={() => setFormular(null)}>
              Abbrechen
            </Button>
            <Button type="submit" form="mitarbeiter-formular" variant="primary" loading={speichert}>
              {formular?.id === null ? "Einladen" : "Speichern"}
            </Button>
          </>
        }
      >
        {formular && (
          <form id="mitarbeiter-formular" onSubmit={speichern}>
            {formFehler && <Message type="fehler">{formFehler}</Message>}
            <FormField label="Name" htmlFor="mitarbeiter-name">
              <Input
                id="mitarbeiter-name"
                value={formular.werte.name}
                onChange={(e) =>
                  setFormular((f) => ({ ...f, werte: { ...f.werte, name: e.target.value } }))
                }
                required
              />
            </FormField>
            <FormField label="E-Mail" htmlFor="mitarbeiter-email">
              <Input
                id="mitarbeiter-email"
                type="email"
                value={formular.werte.email}
                onChange={(e) =>
                  setFormular((f) => ({ ...f, werte: { ...f.werte, email: e.target.value } }))
                }
                required
              />
            </FormField>
            <FormField label="Rolle" htmlFor="mitarbeiter-rolle">
              <Select
                id="mitarbeiter-rolle"
                value={formular.werte.rolle}
                disabled={formular.id === user?.id}
                onChange={(e) =>
                  setFormular((f) => ({ ...f, werte: { ...f.werte, rolle: e.target.value } }))
                }
              >
                {ROLLEN.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </FormField>
          </form>
        )}
      </Dialog>

      <Dialog
        open={archivZiel !== null}
        title="Mitarbeiter archivieren?"
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
        Reiter „Archiv" lässt sich der Mitarbeiter jederzeit wieder reaktivieren.
      </Dialog>

      <Dialog
        open={loeschZiel !== null}
        title="Mitarbeiter endgültig löschen?"
        onClose={() => {
          setLoeschZiel(null);
          setLoeschFehler(null);
        }}
        actions={
          <>
            <Button
              variant="text"
              onClick={() => {
                setLoeschZiel(null);
                setLoeschFehler(null);
              }}
            >
              Abbrechen
            </Button>
            <Button variant="danger" onClick={endgueltigLoeschenBestaetigt}>
              Endgültig löschen
            </Button>
          </>
        }
      >
        {loeschFehler && <Message type="fehler">{loeschFehler}</Message>}
        {loeschZiel?.name} wird komplett aus dem System entfernt. Das lässt sich nicht rückgängig
        machen. Geht nur, solange dieser Mitarbeiter keine Einträge im Änderungsprotokoll hat.
      </Dialog>
    </div>
  );
}
