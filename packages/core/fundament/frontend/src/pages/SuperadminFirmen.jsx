import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import Card from "../components/Card.jsx";
import Zugangsdaten from "../components/Zugangsdaten.jsx";
import Table from "../components/Table.jsx";
import Button from "../components/Button.jsx";
import Dialog from "../components/Dialog.jsx";
import FormField from "../components/FormField.jsx";
import Input from "../components/Input.jsx";
import Textarea from "../components/Textarea.jsx";
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
  listeAlleModule,
  listeModule,
  setzeModulAktiv,
  loescheFirmaEndgueltig,
} from "../superadmin/api.js";

const LEER_KUNDENDATEN = {
  name: "",
  strasse: "",
  plz: "",
  ort: "",
  ansprechpartner: "",
  rechnungsEmail: "",
  telefon: "",
  ustIdNr: "",
  notiz: "",
};

function kundendatenAusFirma(firma) {
  return {
    name: firma.name,
    strasse: firma.strasse || "",
    plz: firma.plz || "",
    ort: firma.ort || "",
    ansprechpartner: firma.ansprechpartner || "",
    rechnungsEmail: firma.rechnungs_email || "",
    telefon: firma.telefon || "",
    ustIdNr: firma.ust_id_nr || "",
    notiz: firma.notiz || "",
  };
}

function istUnvollstaendig(firma) {
  return !firma.strasse || !firma.plz || !firma.ort || !firma.ansprechpartner || !firma.rechnungs_email;
}

// Bausteine-Abschnitt beim Anlegen: reine Checkbox-Auswahl, noch nichts
// gespeichert -- geht erst beim Anlegen-Klick mit in die eine Transaktion.
function BausteineAuswahl({ alleModule, ausgewaehlt, onUmschalten }) {
  if (alleModule === undefined) return <Spinner label="Bausteine werden geladen …" />;
  if (alleModule.length === 0) return <EmptyState>Diese App bietet noch keine Bausteine an.</EmptyState>;
  return (
    <>
      {alleModule.map((m) => (
        <p key={m.name}>
          <Checkbox
            label={`${m.titel}${m.braucht.length ? ` (braucht: ${m.braucht.join(", ")})` : ""}`}
            checked={ausgewaehlt.has(m.name)}
            onChange={() => onUmschalten(m.name)}
          />
          {m.beschreibung && (
            <small style={{ display: "block", marginLeft: 28, color: "var(--ink-mute)" }}>
              {m.beschreibung}
            </small>
          )}
        </p>
      ))}
    </>
  );
}

// Bausteine-Abschnitt beim Bearbeiten: sofortiges Ein-/Ausschalten wie bisher
// (jeder Klick ist ein eigener Speichervorgang, Abschnitt 8).
function BausteineKarte({ firmaId }) {
  const [module, setModule] = useState(undefined);
  const [fehler, setFehler] = useState(null);

  function laden() {
    listeModule(firmaId).then(setModule).catch((err) => setFehler(err.message));
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
    <>
      {fehler && <Message type="fehler">{fehler}</Message>}
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
    </>
  );
}

// Admin einladen -- sowohl beim Anlegen (Felder im selben Fenster, die
// Einladung läuft mit in die eine Transaktion) als auch später beim
// Bearbeiten (eigener Speichervorgang, z. B. für einen zweiten Admin).
function AdminEinladenFelder({ werte, onAendern }) {
  return (
    <>
      <FormField label="Name" htmlFor="admin-name">
        <Input id="admin-name" value={werte.name} onChange={(e) => onAendern({ ...werte, name: e.target.value })} />
      </FormField>
      <FormField label="E-Mail" htmlFor="admin-email">
        <Input
          id="admin-email"
          type="email"
          value={werte.email}
          onChange={(e) => onAendern({ ...werte, email: e.target.value })}
        />
      </FormField>
    </>
  );
}

function AdminEinladenKarte({ firmaId }) {
  const [werte, setWerte] = useState({ name: "", email: "" });
  const [ergebnis, setErgebnis] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [speichert, setSpeichert] = useState(false);

  async function absenden(e) {
    e.preventDefault();
    setSpeichert(true);
    setFehler(null);
    try {
      const daten = await ladeFirmaEinladen(firmaId, werte);
      setErgebnis(daten);
      setWerte({ name: "", email: "" });
    } catch (err) {
      setFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <>
      {fehler && <Message type="fehler">{fehler}</Message>}
      {ergebnis && (
        <Zugangsdaten
          email={ergebnis.email}
          startpasswort={ergebnis.startpasswort}
          onAusblenden={() => setErgebnis(null)}
        />
      )}
      <form onSubmit={absenden}>
        <AdminEinladenFelder werte={werte} onAendern={setWerte} />
        <Button type="submit" variant="primary" loading={speichert}>
          Einladen
        </Button>
      </form>
    </>
  );
}

export default function SuperadminFirmen() {
  const [firmen, setFirmen] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [alleModule, setAlleModule] = useState(undefined);
  const [dialog, setDialog] = useState(null); // null | { id, werte, moduleNeu, admin }
  const [formFehler, setFormFehler] = useState(null);
  const [speichert, setSpeichert] = useState(false);
  const [zugangsdaten, setZugangsdaten] = useState(null);
  const [loeschZiel, setLoeschZiel] = useState(null);
  const [loeschEingabe, setLoeschEingabe] = useState("");
  const [loeschFehler, setLoeschFehler] = useState(null);
  const [loescht, setLoescht] = useState(false);

  function laden() {
    listeFirmen().then(setFirmen).catch((err) => setFehler(err.message));
  }

  useEffect(laden, []);
  useEffect(() => {
    listeAlleModule().then(setAlleModule).catch((err) => setFehler(err.message));
  }, []);

  function oeffneNeu() {
    setFormFehler(null);
    setDialog({ id: null, werte: LEER_KUNDENDATEN, moduleNeu: new Set(), admin: { name: "", email: "" } });
  }

  function oeffneBearbeiten(firma) {
    setFormFehler(null);
    setDialog({ id: firma.id, werte: kundendatenAusFirma(firma), moduleNeu: null, admin: null });
  }

  function schliessen() {
    setDialog(null);
  }

  function moduleNeuUmschalten(name) {
    setDialog((d) => {
      const kopie = new Set(d.moduleNeu);
      if (kopie.has(name)) kopie.delete(name);
      else kopie.add(name);
      return { ...d, moduleNeu: kopie };
    });
  }

  async function speichern(e) {
    e.preventDefault();
    setSpeichert(true);
    setFormFehler(null);
    try {
      if (dialog.id === null) {
        const admin = dialog.admin.name && dialog.admin.email ? dialog.admin : undefined;
        const neu = await legeFirmaAn({
          ...dialog.werte,
          module: [...dialog.moduleNeu],
          admin,
        });
        laden();
        schliessen();
        if (neu.admin) setZugangsdaten({ email: neu.admin.email, startpasswort: neu.admin.startpasswort });
      } else {
        await speichereFirma(dialog.id, dialog.werte);
        laden();
        schliessen();
      }
    } catch (err) {
      setFormFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  async function sperrenUmschalten() {
    const firma = firmen.find((f) => f.id === dialog.id);
    await setzeFirmaAktiv(dialog.id, !firma.aktiv);
    laden();
    schliessen();
  }

  function loeschenOeffnen() {
    const firma = firmen.find((f) => f.id === dialog.id);
    setLoeschZiel(firma);
    setLoeschEingabe("");
    setLoeschFehler(null);
  }

  function loeschenSchliessen() {
    setLoeschZiel(null);
  }

  async function endgueltigLoeschen() {
    setLoescht(true);
    setLoeschFehler(null);
    try {
      await loescheFirmaEndgueltig(loeschZiel.id, loeschEingabe);
      loeschenSchliessen();
      schliessen();
      laden();
    } catch (err) {
      setLoeschFehler(err.message);
    } finally {
      setLoescht(false);
    }
  }

  const bearbeiteteFirma = dialog?.id != null ? firmen?.find((f) => f.id === dialog.id) : null;

  return (
    <div>
      <PageHeader
        title="Firmen"
        meta="Superadmin"
        actions={
          <Button variant="primary" onClick={oeffneNeu}>
            Neue Firma
          </Button>
        }
      />

      {zugangsdaten && (
        <Zugangsdaten
          email={zugangsdaten.email}
          startpasswort={zugangsdaten.startpasswort}
          onAusblenden={() => setZugangsdaten(null)}
        />
      )}

      <Card>
        {fehler && <Message type="fehler">{fehler}</Message>}
        {firmen === undefined && <Spinner label="Firmen werden geladen …" />}
        {firmen && (
          <Table
            columns={[
              { key: "kundennummer", label: "Kundennummer", sortable: true },
              {
                key: "name",
                label: "Name",
                sortable: true,
                render: (f) => (
                  <>
                    {f.name}
                    {istUnvollstaendig(f) && (
                      <span style={{ marginLeft: 8 }}>
                        <Badge status="warn">Daten unvollständig</Badge>
                      </span>
                    )}
                  </>
                ),
              },
              { key: "ort", label: "Ort", render: (f) => f.ort || "–" },
              {
                key: "aktiv",
                label: "Status",
                render: (f) => (
                  <Badge status={f.aktiv ? "success" : "danger"}>{f.aktiv ? "Aktiv" : "Gesperrt"}</Badge>
                ),
              },
              {
                key: "bausteine",
                label: "Bausteine",
                render: (f) => (f.bausteine_anzahl > 0 ? f.bausteine_anzahl : "–"),
              },
            ]}
            rows={firmen}
            rowKey={(f) => f.id}
            emptyText="Noch keine Firmen angelegt."
            onRowClick={oeffneBearbeiten}
          />
        )}
      </Card>

      <Dialog
        open={dialog !== null}
        wide
        title={dialog?.id === null ? "Neue Firma" : "Firma bearbeiten"}
        onClose={schliessen}
        actions={
          <>
            <Button variant="text" onClick={schliessen}>
              Abbrechen
            </Button>
            <Button type="submit" form="firma-formular" variant="primary" loading={speichert}>
              {dialog?.id === null ? "Anlegen" : "Speichern"}
            </Button>
          </>
        }
      >
        {dialog && (
          <form id="firma-formular" onSubmit={speichern}>
            {formFehler && <Message type="fehler">{formFehler}</Message>}

            <p className="form-section-label">Kundendaten</p>
            <FormField label="Firmenname" htmlFor="firma-name">
              <Input
                id="firma-name"
                value={dialog.werte.name}
                onChange={(e) => setDialog((d) => ({ ...d, werte: { ...d.werte, name: e.target.value } }))}
                required
              />
            </FormField>
            <FormField label="Straße und Hausnummer" htmlFor="firma-strasse">
              <Input
                id="firma-strasse"
                value={dialog.werte.strasse}
                onChange={(e) => setDialog((d) => ({ ...d, werte: { ...d.werte, strasse: e.target.value } }))}
                required
              />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <FormField label="PLZ" htmlFor="firma-plz">
                <Input
                  id="firma-plz"
                  value={dialog.werte.plz}
                  onChange={(e) => setDialog((d) => ({ ...d, werte: { ...d.werte, plz: e.target.value } }))}
                  required
                />
              </FormField>
              <FormField label="Ort" htmlFor="firma-ort">
                <Input
                  id="firma-ort"
                  value={dialog.werte.ort}
                  onChange={(e) => setDialog((d) => ({ ...d, werte: { ...d.werte, ort: e.target.value } }))}
                  required
                />
              </FormField>
            </div>
            <FormField label="Ansprechpartner" htmlFor="firma-ansprechpartner">
              <Input
                id="firma-ansprechpartner"
                value={dialog.werte.ansprechpartner}
                onChange={(e) =>
                  setDialog((d) => ({ ...d, werte: { ...d.werte, ansprechpartner: e.target.value } }))
                }
                required
              />
            </FormField>
            <FormField label="Rechnungs-E-Mail" htmlFor="firma-rechnungs-email">
              <Input
                id="firma-rechnungs-email"
                type="email"
                value={dialog.werte.rechnungsEmail}
                onChange={(e) =>
                  setDialog((d) => ({ ...d, werte: { ...d.werte, rechnungsEmail: e.target.value } }))
                }
                required
              />
            </FormField>
            <FormField label="Telefon" htmlFor="firma-telefon">
              <Input
                id="firma-telefon"
                value={dialog.werte.telefon}
                onChange={(e) => setDialog((d) => ({ ...d, werte: { ...d.werte, telefon: e.target.value } }))}
              />
            </FormField>
            <FormField label="USt-IdNr." htmlFor="firma-ust-id-nr">
              <Input
                id="firma-ust-id-nr"
                value={dialog.werte.ustIdNr}
                onChange={(e) => setDialog((d) => ({ ...d, werte: { ...d.werte, ustIdNr: e.target.value } }))}
              />
            </FormField>
            <FormField label="Notiz (nur für Superadmin sichtbar)" htmlFor="firma-notiz">
              <Textarea
                id="firma-notiz"
                value={dialog.werte.notiz}
                onChange={(e) => setDialog((d) => ({ ...d, werte: { ...d.werte, notiz: e.target.value } }))}
              />
            </FormField>

            <p className="form-section-label">Bausteine</p>
            {dialog.id === null ? (
              <BausteineAuswahl
                alleModule={alleModule}
                ausgewaehlt={dialog.moduleNeu}
                onUmschalten={moduleNeuUmschalten}
              />
            ) : (
              <BausteineKarte firmaId={dialog.id} />
            )}

            {dialog.id === null ? (
              <>
                <p className="form-section-label">Erster Admin (optional)</p>
                <AdminEinladenFelder werte={dialog.admin} onAendern={(admin) => setDialog((d) => ({ ...d, admin }))} />
              </>
            ) : (
              <>
                <p className="form-section-label">Admin einladen</p>
                <AdminEinladenKarte firmaId={dialog.id} />
              </>
            )}

            {dialog.id !== null && bearbeiteteFirma && (
              <>
                <p className="form-section-label">Gefahrenbereich</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button type="button" variant="secondary" onClick={sperrenUmschalten}>
                    {bearbeiteteFirma.aktiv ? "Sperren" : "Entsperren"}
                  </Button>
                  {!bearbeiteteFirma.aktiv && (
                    <Button type="button" variant="danger" onClick={loeschenOeffnen}>
                      Endgültig löschen
                    </Button>
                  )}
                </div>
              </>
            )}
          </form>
        )}
      </Dialog>

      <Dialog
        open={loeschZiel !== null}
        title="Firma endgültig löschen"
        onClose={loeschenSchliessen}
        actions={
          <>
            <Button variant="text" onClick={loeschenSchliessen}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={loescht}
              disabled={loeschEingabe !== loeschZiel?.name}
              onClick={endgueltigLoeschen}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <p>
          Löscht <strong>alle</strong> Daten von <strong>{loeschZiel?.name}</strong> unwiderruflich:
          Kontakte, Notizen, Aufgaben, Projekte, Mitarbeiter, Sitzungen, Rechte, Bausteine,
          Dashboard und das Änderungsprotokoll. Das kann nicht zurückgenommen werden.
        </p>
        <p className="farb-hinweis">Vorher ein Backup anlegen.</p>
        {loeschFehler && <Message type="fehler">{loeschFehler}</Message>}
        <FormField
          label={`Zur Bestätigung den Firmennamen eintippen: "${loeschZiel?.name}"`}
          htmlFor="firma-loeschen-bestaetigung"
        >
          <Input
            id="firma-loeschen-bestaetigung"
            value={loeschEingabe}
            onChange={(e) => setLoeschEingabe(e.target.value)}
            autoComplete="off"
          />
        </FormField>
      </Dialog>
    </div>
  );
}
