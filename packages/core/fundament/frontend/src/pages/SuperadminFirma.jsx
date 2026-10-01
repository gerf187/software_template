import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import Card from "../components/Card.jsx";
import FormField from "../components/FormField.jsx";
import Input from "../components/Input.jsx";
import Button from "../components/Button.jsx";
import Message from "../components/Message.jsx";
import Checkbox from "../components/Checkbox.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { ladeFirmaEinladen, listeModule, setzeModulAktiv } from "../superadmin/api.js";

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
        <Message type="erfolg">
          Angelegt: {ergebnis.email}. Startpasswort (einmalig, bitte sicher übermitteln):{" "}
          <strong>{ergebnis.startpasswort}</strong> — muss beim ersten Login geändert werden.
        </Message>
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

export default function SuperadminFirma() {
  const { id } = useParams();
  return (
    <div>
      <PageHeader title="Firma verwalten" meta="Superadmin" />
      <EinladenKarte firmaId={id} />
      <div style={{ height: 24 }} />
      <BausteineKarte firmaId={id} />
    </div>
  );
}
