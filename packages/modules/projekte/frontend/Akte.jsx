import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RecordView from "@fundament/frontend/src/components/RecordView.jsx";
import Card from "@fundament/frontend/src/components/Card.jsx";
import Badge from "@fundament/frontend/src/components/Badge.jsx";
import Button from "@fundament/frontend/src/components/Button.jsx";
import Dialog from "@fundament/frontend/src/components/Dialog.jsx";
import Message from "@fundament/frontend/src/components/Message.jsx";
import Spinner from "@fundament/frontend/src/components/Spinner.jsx";
import EmptyState from "@fundament/frontend/src/components/EmptyState.jsx";
import Checkbox from "@fundament/frontend/src/components/Checkbox.jsx";
import Textarea from "@fundament/frontend/src/components/Textarea.jsx";
import Input from "@fundament/frontend/src/components/Input.jsx";
import { useAuth } from "@fundament/frontend/src/auth/AuthContext.jsx";
import { holeKontakt } from "@fundament/frontend/src/kontakte/api.js";
import { erweiterungsTabs, erweiterungsKomponente } from "@fundament/frontend/src/module/registry.js";
import appConfig from "~app-config";
import {
  holeProjekt,
  speichereProjekt,
  setzePhase,
  loescheProjekt,
  listeProjektNotizen,
  legeProjektNotizAn,
  listeProjektAufgaben,
  legeProjektAufgabeAn,
  setzeProjektAufgabeErledigt,
  holeProjektVerlauf,
} from "./api.js";
import ProjektFormular from "./ProjektFormular.jsx";

const PROJEKTE_CONFIG = appConfig.projekte || { phasen: [], status: [] };
const AKTION_TEXT = { angelegt: "Angelegt", geaendert: "Geändert", geloescht: "Gelöscht" };

function adresseText(p) {
  return [p.objektadresseStrasse, [p.objektadressePlz, p.objektadresseOrt].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

function Kopfkarte({ projekt, kontakt }) {
  const statusEintrag = PROJEKTE_CONFIG.status.find((s) => s.label === projekt.status);
  const adresse = adresseText(projekt);
  return (
    <Card>
      <div className="kontakt-kopfkarte">
        <Badge status={statusEintrag?.terminal ? "neutral" : "success"}>{projekt.status}</Badge>
        {projekt.arten.map((a) => (
          <Badge key={a}>{a}</Badge>
        ))}
        {kontakt && (
          <span className="kontakt-kopfkarte-zeile">
            <span className="kontakt-kopfkarte-label">Kontakt</span>
            <a href={`/kontakte/${kontakt.id}`}>
              {[kontakt.vorname, kontakt.nachname].filter(Boolean).join(" ") || kontakt.organisation}
            </a>
          </span>
        )}
        {kontakt?.telefon && (
          <span className="kontakt-kopfkarte-zeile">
            <span className="kontakt-kopfkarte-label">Telefon</span>
            <a href={`tel:${kontakt.telefon.replace(/[^+\d]/g, "")}`}>{kontakt.telefon}</a>
          </span>
        )}
        {kontakt?.email && (
          <span className="kontakt-kopfkarte-zeile">
            <span className="kontakt-kopfkarte-label">E-Mail</span>
            <a href={`mailto:${kontakt.email}`}>{kontakt.email}</a>
          </span>
        )}
        {adresse && <span className="kontakt-kopfkarte-adresse">{adresse}</span>}
        {projekt.auftragsdatum && (
          <span className="kontakt-kopfkarte-zeile">
            <span className="kontakt-kopfkarte-label">{PROJEKTE_CONFIG.auftragsdatumLabel || "Auftragsdatum"}</span>
            <strong>{new Date(projekt.auftragsdatum).toLocaleDateString("de-DE")}</strong>
          </span>
        )}
        {projekt.pausiertGrund && (
          <span className="kontakt-kopfkarte-zeile">
            <span className="kontakt-kopfkarte-label">Grund der Pausierung</span>
            {projekt.pausiertGrund}
          </span>
        )}
        {projekt.ablageLink && (
          <Button variant="secondary" onClick={() => window.open(projekt.ablageLink, "_blank", "noopener")}>
            Ordner öffnen
          </Button>
        )}
      </div>
    </Card>
  );
}

export function UebersichtTab({ projekt }) {
  const zeilen = [
    ["Projektname", projekt.name],
    ["Projektart(en)", projekt.arten.join(", ")],
    ["Phase", projekt.phase],
    ["Status", projekt.status],
    ["Objektadresse", adresseText(projekt)],
  ].filter(([, wert]) => wert);
  // Immer sichtbar, leer als "–" (Abschnitt 9: ehrliche Werte).
  zeilen.push(
    [
      PROJEKTE_CONFIG.auftragsdatumLabel || "Auftragsdatum",
      projekt.auftragsdatum ? new Date(projekt.auftragsdatum).toLocaleDateString("de-DE") : "–",
    ],
    [
      "Ablage-Link",
      projekt.ablageLink ? (
        <a href={projekt.ablageLink} target="_blank" rel="noopener noreferrer">
          {projekt.ablageLink}
        </a>
      ) : (
        "–"
      ),
    ]
  );

  return (
    <Card title="Übersicht">
      {zeilen.map(([label, wert]) => (
        <p key={label}>
          <strong>{label}:</strong> {wert}
        </p>
      ))}
    </Card>
  );
}

function NotizenTab({ projektId, darfBearbeiten }) {
  const [notizen, setNotizen] = useState(undefined);
  const [text, setText] = useState("");
  const [speichert, setSpeichert] = useState(false);

  function laden() {
    listeProjektNotizen(projektId).then(setNotizen);
  }
  useEffect(laden, [projektId]);

  async function absenden(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSpeichert(true);
    await legeProjektNotizAn(projektId, text);
    setText("");
    setSpeichert(false);
    laden();
  }

  return (
    <Card title="Notizen">
      {darfBearbeiten && (
        <form onSubmit={absenden} style={{ marginBottom: 16 }}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Neue Notiz …" />
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
          <small style={{ color: "var(--ink-mute)" }}>{new Date(n.erstellt_am).toLocaleString("de-DE")}</small>
        </p>
      ))}
    </Card>
  );
}

function AufgabenTab({ projektId, darfBearbeiten }) {
  const [aufgaben, setAufgaben] = useState(undefined);
  const [text, setText] = useState("");
  const [faelligAm, setFaelligAm] = useState("");
  const [speichert, setSpeichert] = useState(false);

  function laden() {
    listeProjektAufgaben(projektId).then(setAufgaben);
  }
  useEffect(laden, [projektId]);

  async function absenden(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSpeichert(true);
    await legeProjektAufgabeAn(projektId, text, faelligAm);
    setText("");
    setFaelligAm("");
    setSpeichert(false);
    laden();
  }

  async function erledigtUmschalten(aufgabe) {
    await setzeProjektAufgabeErledigt(projektId, aufgabe.id, aufgabe.status !== "erledigt");
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

function VerlaufTab({ projektId }) {
  const [eintraege, setEintraege] = useState(undefined);
  useEffect(() => {
    holeProjektVerlauf(projektId).then(setEintraege);
  }, [projektId]);

  return (
    <Card title="Verlauf">
      {eintraege === undefined && <Spinner label="Verlauf wird geladen …" />}
      {eintraege?.length === 0 && <EmptyState>Noch keine Änderungen protokolliert.</EmptyState>}
      {eintraege?.map((e) => (
        <div key={e.id} className="verlauf-eintrag">
          <p>
            <strong>{AKTION_TEXT[e.aktion] || e.aktion}</strong> am {new Date(e.zeitpunkt).toLocaleString("de-DE")}
            {e.benutzer_name ? ` von ${e.benutzer_name}` : ""}
          </p>
          {e.aenderungen?.map((a) => (
            <p key={a.feld} className="verlauf-aenderung">
              {a.feld}: {a.alt} → {a.neu}
            </p>
          ))}
        </div>
      ))}
    </Card>
  );
}

export default function ProjektAkte() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projekt, setProjekt] = useState(undefined);
  const [kontakt, setKontakt] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [tab, setTab] = useState("uebersicht");
  const [bearbeitenOffen, setBearbeitenOffen] = useState(false);
  const [loeschenOffen, setLoeschenOffen] = useState(false);

  function laden() {
    holeProjekt(id)
      .then((p) => {
        setProjekt(p);
        return holeKontakt(p.contactId);
      })
      .then(setKontakt)
      .catch((err) => setFehler(err.message));
  }
  useEffect(laden, [id]);

  const darfBearbeiten = !!user?.rechte?.projekte?.bearbeiten;
  const darfLoeschen = !!user?.rechte?.projekte?.loeschen;
  const darfVerlaufSehen = !!user?.rechte?.protokoll?.sehen;
  // Spätere Fach-Bausteine melden hier eigene Tabs an (Teil 1, Punkt 6).
  const zusatzTabs = erweiterungsTabs("projektTabs", user?.module);

  async function speichern(daten) {
    const aktualisiert = await speichereProjekt(id, daten);
    setProjekt(aktualisiert);
    setBearbeitenOffen(false);
  }

  async function phaseSetzen(phase) {
    const aktualisiert = await setzePhase(id, phase);
    setProjekt(aktualisiert);
  }

  async function loeschen() {
    await loescheProjekt(id);
    navigate("/projekte");
  }

  if (fehler) return <Message type="fehler">{fehler}</Message>;
  if (projekt === undefined || kontakt === undefined) return <Spinner label="Projekt wird geladen …" />;

  return (
    <div>
      <RecordView
        title={projekt.name}
        subheader={
          <div className="record-view-subheader">
            <Kopfkarte projekt={projekt} kontakt={kontakt} />
          </div>
        }
        actions={
          <>
            {darfBearbeiten && (
              <Button variant="secondary" onClick={() => setBearbeitenOffen(true)}>
                Bearbeiten
              </Button>
            )}
            {darfLoeschen && (
              <Button variant="danger" onClick={() => setLoeschenOffen(true)}>
                Löschen
              </Button>
            )}
          </>
        }
        phases={PROJEKTE_CONFIG.phasen}
        activePhase={projekt.phase}
        onPhaseClick={darfBearbeiten ? phaseSetzen : undefined}
        tabs={[
          { key: "uebersicht", label: "Übersicht" },
          { key: "notizen", label: "Notizen" },
          { key: "aufgaben", label: "Aufgaben" },
          ...(darfVerlaufSehen ? [{ key: "verlauf", label: "Verlauf" }] : []),
          ...zusatzTabs.map((t) => ({ key: `modul-${t.modul}-${t.key}`, label: t.label })),
        ]}
        activeTab={tab}
        onTabChange={setTab}
      >
        {tab === "uebersicht" && <UebersichtTab projekt={projekt} />}
        {tab === "notizen" && <NotizenTab projektId={id} darfBearbeiten={darfBearbeiten} />}
        {tab === "aufgaben" && <AufgabenTab projektId={id} darfBearbeiten={darfBearbeiten} />}
        {tab === "verlauf" && darfVerlaufSehen && <VerlaufTab projektId={id} />}
        {zusatzTabs.map((t) => {
          const key = `modul-${t.modul}-${t.key}`;
          if (tab !== key) return null;
          const Komponente = erweiterungsKomponente("projektTabs", t.modul, t.key);
          return Komponente ? <Komponente key={key} projektId={id} projekt={projekt} /> : null;
        })}
      </RecordView>

      <Dialog open={bearbeitenOffen} title="Projekt bearbeiten" onClose={() => setBearbeitenOffen(false)} wide>
        <ProjektFormular kontakt={kontakt} projekt={projekt} onSpeichern={speichern} onAbbrechen={() => setBearbeitenOffen(false)} />
      </Dialog>

      <Dialog
        open={loeschenOffen}
        title="Projekt wirklich löschen?"
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
        Das Projekt wird archiviert und erscheint nicht mehr in der Liste. Die Daten bleiben erhalten.
      </Dialog>
    </div>
  );
}
