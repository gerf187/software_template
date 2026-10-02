import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RecordView from "../components/RecordView.jsx";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Dialog from "../components/Dialog.jsx";
import Message from "../components/Message.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Checkbox from "../components/Checkbox.jsx";
import Textarea from "../components/Textarea.jsx";
import Input from "../components/Input.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import KontaktFormular from "../kontakte/KontaktFormular.jsx";
import {
  holeKontakt,
  speichereKontakt,
  loescheKontakt,
  listeNotizen,
  legeNotizAn,
  listeAufgaben,
  legeAufgabeAn,
  setzeAufgabeErledigt,
  holeVerlauf,
  exportiereKontakt,
} from "../kontakte/api.js";

function anzeigename(k) {
  return [k.vorname, k.nachname].filter(Boolean).join(" ") || "(ohne Namen)";
}

const AKTION_TEXT = { angelegt: "Angelegt", geaendert: "Geändert", geloescht: "Gelöscht" };

function adresseText(kontakt) {
  return [
    kontakt.wohnadresse_strasse,
    [kontakt.wohnadresse_plz, kontakt.wohnadresse_ort].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function Kopfkarte({ kontakt }) {
  const adresse = adresseText(kontakt);
  return (
    <Card>
      <div className="kontakt-kopfkarte">
        {kontakt.organisation && (
          <span className="kontakt-kopfkarte-organisation">{kontakt.organisation}</span>
        )}
        {kontakt.telefon && <a href={`tel:${kontakt.telefon}`}>{kontakt.telefon}</a>}
        {kontakt.email && <a href={`mailto:${kontakt.email}`}>{kontakt.email}</a>}
        {adresse && <span className="kontakt-kopfkarte-adresse">{adresse}</span>}
      </div>
    </Card>
  );
}

function ÜbersichtTab({ kontakt }) {
  const zeilen = [
    ["Anrede", kontakt.anrede],
    ["Vorname", kontakt.vorname],
    ["Nachname", kontakt.nachname],
    ["Firma / Organisation", kontakt.organisation],
    ["E-Mail", kontakt.email],
    ["Telefon", kontakt.telefon],
    ["Mobil", kontakt.mobil],
    ["Adresse", adresseText(kontakt)],
    ["Empfohlen von", kontakt.empfohlen_von_text || kontakt.empfohlen_von_kontakt_name],
  ].filter(([, wert]) => wert);

  return (
    <Card title="Übersicht">
      {zeilen.length === 0 && <EmptyState>Keine Angaben.</EmptyState>}
      {zeilen.map(([label, wert]) => (
        <p key={label}>
          <strong>{label}:</strong> {wert}
        </p>
      ))}
    </Card>
  );
}

function NotizenTab({ kontaktId, darfBearbeiten }) {
  const [notizen, setNotizen] = useState(undefined);
  const [text, setText] = useState("");
  const [speichert, setSpeichert] = useState(false);

  function laden() {
    listeNotizen(kontaktId).then(setNotizen);
  }

  useEffect(laden, [kontaktId]);

  async function absenden(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSpeichert(true);
    await legeNotizAn(kontaktId, text);
    setText("");
    setSpeichert(false);
    laden();
  }

  return (
    <Card title="Notizen">
      {darfBearbeiten && (
        <form onSubmit={absenden} style={{ marginBottom: 16 }}>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Neue Notiz …"
          />
          <div style={{ marginTop: 8 }}>
            <Button type="submit" variant="primary" loading={speichert}>
              Notiz speichern
            </Button>
          </div>
        </form>
      )}
      {notizen === undefined && <Spinner label="Notizen werden geladen …" />}
      {notizen?.length === 0 && <EmptyState>Keine Notizen vorhanden.</EmptyState>}
      {notizen?.map((n) => (
        <p key={n.id} style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: 8 }}>
          {n.text}
          <br />
          <small style={{ color: "var(--ink-mute)" }}>
            {new Date(n.erstellt_am).toLocaleString("de-DE")}
          </small>
        </p>
      ))}
    </Card>
  );
}

function AufgabenTab({ kontaktId, darfBearbeiten }) {
  const [aufgaben, setAufgaben] = useState(undefined);
  const [text, setText] = useState("");
  const [faelligAm, setFaelligAm] = useState("");
  const [speichert, setSpeichert] = useState(false);

  function laden() {
    listeAufgaben(kontaktId).then(setAufgaben);
  }

  useEffect(laden, [kontaktId]);

  async function absenden(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSpeichert(true);
    await legeAufgabeAn(kontaktId, text, faelligAm);
    setText("");
    setFaelligAm("");
    setSpeichert(false);
    laden();
  }

  async function erledigtUmschalten(aufgabe) {
    await setzeAufgabeErledigt(kontaktId, aufgabe.id, aufgabe.status !== "erledigt");
    laden();
  }

  return (
    <Card title="Aufgaben">
      {darfBearbeiten && (
        <form onSubmit={absenden} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Input
            placeholder="Neue Aufgabe …"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <Input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} />
          <Button type="submit" variant="primary" loading={speichert}>
            Hinzufügen
          </Button>
        </form>
      )}
      {aufgaben === undefined && <Spinner label="Aufgaben werden geladen …" />}
      {aufgaben?.length === 0 && <EmptyState>Keine Aufgaben vorhanden.</EmptyState>}
      {aufgaben?.map((a) => (
        <p key={a.id}>
          <Checkbox
            label={a.text}
            checked={a.status === "erledigt"}
            disabled={!darfBearbeiten}
            onChange={() => darfBearbeiten && erledigtUmschalten(a)}
          />
          {a.faellig_am && (
            <small style={{ color: "var(--ink-mute)", marginLeft: 28 }}>
              fällig am {new Date(a.faellig_am).toLocaleDateString("de-DE")}
            </small>
          )}
        </p>
      ))}
    </Card>
  );
}

function VerlaufTab({ kontaktId }) {
  const [eintraege, setEintraege] = useState(undefined);

  useEffect(() => {
    holeVerlauf(kontaktId).then(setEintraege);
  }, [kontaktId]);

  return (
    <Card title="Verlauf">
      {eintraege === undefined && <Spinner label="Verlauf wird geladen …" />}
      {eintraege?.length === 0 && <EmptyState>Noch keine Änderungen protokolliert.</EmptyState>}
      {eintraege?.map((e) => (
        <p key={e.id}>
          <strong>{AKTION_TEXT[e.aktion] || e.aktion}</strong> am{" "}
          {new Date(e.zeitpunkt).toLocaleString("de-DE")}
          {e.benutzer_name ? ` von ${e.benutzer_name}` : ""}
        </p>
      ))}
    </Card>
  );
}

export default function KontaktAkte() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [kontakt, setKontakt] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [tab, setTab] = useState("uebersicht");
  const [bearbeitenOffen, setBearbeitenOffen] = useState(false);
  const [loeschenOffen, setLoeschenOffen] = useState(false);

  function laden() {
    holeKontakt(id)
      .then(setKontakt)
      .catch((err) => setFehler(err.message));
  }

  useEffect(laden, [id]);

  const darfBearbeiten = !!user?.rechte?.kontakte?.bearbeiten;
  const darfLoeschen = !!user?.rechte?.kontakte?.loeschen;
  const darfVerlaufSehen = !!user?.rechte?.protokoll?.sehen;

  async function speichern(daten) {
    const aktualisiert = await speichereKontakt(id, daten);
    setKontakt(aktualisiert);
    setBearbeitenOffen(false);
  }

  async function loeschen() {
    await loescheKontakt(id);
    navigate("/kontakte");
  }

  if (fehler) return <Message type="fehler">{fehler}</Message>;
  if (kontakt === undefined) return <Spinner label="Kontakt wird geladen …" />;

  return (
    <div>
      <RecordView
        title={anzeigename(kontakt)}
        subheader={
          <div className="record-view-subheader">
            <Kopfkarte kontakt={kontakt} />
          </div>
        }
        actions={
          <>
            {darfBearbeiten && (
              <Button variant="secondary" onClick={() => setBearbeitenOffen(true)}>
                Bearbeiten
              </Button>
            )}
            <Button variant="secondary" onClick={() => exportiereKontakt(id)}>
              Daten exportieren
            </Button>
            {darfLoeschen && (
              <Button variant="danger" onClick={() => setLoeschenOffen(true)}>
                Löschen
              </Button>
            )}
          </>
        }
        tabs={[
          { key: "uebersicht", label: "Übersicht" },
          { key: "notizen", label: "Notizen" },
          { key: "aufgaben", label: "Aufgaben" },
          ...(darfVerlaufSehen ? [{ key: "verlauf", label: "Verlauf" }] : []),
        ]}
        activeTab={tab}
        onTabChange={setTab}
      >
        {tab === "uebersicht" && <ÜbersichtTab kontakt={kontakt} />}
        {tab === "notizen" && <NotizenTab kontaktId={id} darfBearbeiten={darfBearbeiten} />}
        {tab === "aufgaben" && <AufgabenTab kontaktId={id} darfBearbeiten={darfBearbeiten} />}
        {tab === "verlauf" && darfVerlaufSehen && <VerlaufTab kontaktId={id} />}
      </RecordView>

      <Dialog
        open={bearbeitenOffen}
        title="Kontakt bearbeiten"
        onClose={() => setBearbeitenOffen(false)}
        wide
      >
        <KontaktFormular
          kontakt={kontakt}
          onSpeichern={speichern}
          onAbbrechen={() => setBearbeitenOffen(false)}
        />
      </Dialog>

      <Dialog
        open={loeschenOffen}
        title="Kontakt wirklich löschen?"
        onClose={() => setLoeschenOffen(false)}
        actions={
          <>
            <Button variant="text" onClick={() => setLoeschenOffen(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={loeschen}>
              Löschen
            </Button>
          </>
        }
      >
        Der Kontakt wird archiviert und erscheint nicht mehr in der Liste. Die Daten bleiben
        erhalten.
      </Dialog>
    </div>
  );
}
