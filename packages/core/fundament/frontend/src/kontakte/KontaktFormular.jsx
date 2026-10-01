import { useState } from "react";
import FormField from "../components/FormField.jsx";
import Input from "../components/Input.jsx";
import Select from "../components/Select.jsx";
import Button from "../components/Button.jsx";
import Message from "../components/Message.jsx";

const LEER = {
  anrede: "",
  vorname: "",
  nachname: "",
  organisation: "",
  email: "",
  telefon: "",
  mobil: "",
  wohnadresseStrasse: "",
  wohnadressePlz: "",
  wohnadresseOrt: "",
  objektadresseStrasse: "",
  objektadressePlz: "",
  objektadresseOrt: "",
  empfohlenVonKontaktId: "",
  empfohlenVonText: "",
};

function ausKontakt(kontakt) {
  if (!kontakt) return LEER;
  return {
    anrede: kontakt.anrede || "",
    vorname: kontakt.vorname || "",
    nachname: kontakt.nachname || "",
    organisation: kontakt.organisation || "",
    email: kontakt.email || "",
    telefon: kontakt.telefon || "",
    mobil: kontakt.mobil || "",
    wohnadresseStrasse: kontakt.wohnadresse_strasse || "",
    wohnadressePlz: kontakt.wohnadresse_plz || "",
    wohnadresseOrt: kontakt.wohnadresse_ort || "",
    objektadresseStrasse: kontakt.objektadresse_strasse || "",
    objektadressePlz: kontakt.objektadresse_plz || "",
    objektadresseOrt: kontakt.objektadresse_ort || "",
    empfohlenVonKontaktId: kontakt.empfohlen_von_kontakt_id || "",
    empfohlenVonText: kontakt.empfohlen_von_text || "",
  };
}

// Formular für Anlegen und Bearbeiten (Abschnitt 11): Wohn- und
// Objektadresse getrennt, "Empfohlen von" entweder anderer Kontakt oder Freitext.
export default function KontaktFormular({ kontakt, andereKontakte = [], onSpeichern, onAbbrechen }) {
  const [werte, setWerte] = useState(() => ausKontakt(kontakt));
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState(null);

  function feld(name) {
    return {
      value: werte[name],
      onChange: (e) => setWerte((w) => ({ ...w, [name]: e.target.value })),
    };
  }

  async function absenden(e) {
    e.preventDefault();
    if (!werte.nachname.trim()) {
      setFehler("Bitte einen Nachnamen angeben.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      await onSpeichern({
        ...werte,
        empfohlenVonKontaktId: werte.empfohlenVonKontaktId || null,
        empfohlenVonText: werte.empfohlenVonKontaktId ? "" : werte.empfohlenVonText,
      });
    } catch (err) {
      setFehler(err.message);
      setSpeichert(false);
    }
  }

  const auswahlbareKontakte = andereKontakte.filter((k) => k.id !== kontakt?.id);

  return (
    <form onSubmit={absenden}>
      {fehler && <Message type="fehler">{fehler}</Message>}

      <FormField label="Anrede" htmlFor="kf-anrede">
        <Select id="kf-anrede" {...feld("anrede")}>
          <option value="">—</option>
          <option value="Frau">Frau</option>
          <option value="Herr">Herr</option>
        </Select>
      </FormField>
      <FormField label="Vorname" htmlFor="kf-vorname">
        <Input id="kf-vorname" {...feld("vorname")} />
      </FormField>
      <FormField label="Nachname" htmlFor="kf-nachname">
        <Input id="kf-nachname" {...feld("nachname")} required />
      </FormField>
      <FormField label="Firma / Organisation" htmlFor="kf-organisation">
        <Input id="kf-organisation" {...feld("organisation")} />
      </FormField>
      <FormField label="E-Mail" htmlFor="kf-email">
        <Input id="kf-email" type="email" {...feld("email")} />
      </FormField>
      <FormField label="Telefon" htmlFor="kf-telefon">
        <Input id="kf-telefon" {...feld("telefon")} />
      </FormField>
      <FormField label="Mobil" htmlFor="kf-mobil">
        <Input id="kf-mobil" {...feld("mobil")} />
      </FormField>

      <FormField label="Wohnadresse – Straße" htmlFor="kf-wa-strasse">
        <Input id="kf-wa-strasse" {...feld("wohnadresseStrasse")} />
      </FormField>
      <FormField label="Wohnadresse – PLZ" htmlFor="kf-wa-plz">
        <Input id="kf-wa-plz" {...feld("wohnadressePlz")} />
      </FormField>
      <FormField label="Wohnadresse – Ort" htmlFor="kf-wa-ort">
        <Input id="kf-wa-ort" {...feld("wohnadresseOrt")} />
      </FormField>

      <FormField label="Objektadresse – Straße (falls abweichend)" htmlFor="kf-oa-strasse">
        <Input id="kf-oa-strasse" {...feld("objektadresseStrasse")} />
      </FormField>
      <FormField label="Objektadresse – PLZ" htmlFor="kf-oa-plz">
        <Input id="kf-oa-plz" {...feld("objektadressePlz")} />
      </FormField>
      <FormField label="Objektadresse – Ort" htmlFor="kf-oa-ort">
        <Input id="kf-oa-ort" {...feld("objektadresseOrt")} />
      </FormField>

      <FormField label="Empfohlen von (anderer Kontakt)" htmlFor="kf-empf-kontakt">
        <Select id="kf-empf-kontakt" {...feld("empfohlenVonKontaktId")}>
          <option value="">— Kein Kontakt —</option>
          {auswahlbareKontakte.map((k) => (
            <option key={k.id} value={k.id}>
              {[k.vorname, k.nachname].filter(Boolean).join(" ")}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Empfohlen von (Freitext, z. B. Google)" htmlFor="kf-empf-text">
        <Input
          id="kf-empf-text"
          {...feld("empfohlenVonText")}
          disabled={!!werte.empfohlenVonKontaktId}
        />
      </FormField>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <Button type="button" variant="text" onClick={onAbbrechen}>
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" loading={speichert}>
          Speichern
        </Button>
      </div>
    </form>
  );
}
