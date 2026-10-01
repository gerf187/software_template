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
  strasse: "",
  plz: "",
  ort: "",
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
    strasse: kontakt.wohnadresse_strasse || "",
    plz: kontakt.wohnadresse_plz || "",
    ort: kontakt.wohnadresse_ort || "",
  };
}

// Formular für Anlegen und Bearbeiten (Abschnitt 11): nach Themen gruppiert
// und zweispaltig, damit es auf dem Bildschirm kompakt bleibt (mobil einspaltig,
// siehe .form-grid in components.css).
export default function KontaktFormular({ kontakt, onSpeichern, onAbbrechen }) {
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
        wohnadresseStrasse: werte.strasse,
        wohnadressePlz: werte.plz,
        wohnadresseOrt: werte.ort,
      });
    } catch (err) {
      setFehler(err.message);
      setSpeichert(false);
    }
  }

  return (
    <form onSubmit={absenden}>
      {fehler && <Message type="fehler">{fehler}</Message>}

      <div className="form-section">
        <div className="form-section-label">Person</div>
        <div className="form-grid">
          <FormField label="Anrede" htmlFor="kf-anrede">
            <Select id="kf-anrede" {...feld("anrede")}>
              <option value="">—</option>
              <option value="Frau">Frau</option>
              <option value="Herr">Herr</option>
            </Select>
          </FormField>
          <FormField label="Firma / Organisation" htmlFor="kf-organisation">
            <Input id="kf-organisation" {...feld("organisation")} />
          </FormField>
          <FormField label="Vorname" htmlFor="kf-vorname">
            <Input id="kf-vorname" {...feld("vorname")} />
          </FormField>
          <FormField label="Nachname" htmlFor="kf-nachname">
            <Input id="kf-nachname" {...feld("nachname")} required />
          </FormField>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-label">Kontakt</div>
        <div className="form-grid">
          <FormField label="E-Mail" htmlFor="kf-email">
            <Input id="kf-email" type="email" {...feld("email")} />
          </FormField>
          <FormField label="Telefon" htmlFor="kf-telefon">
            <Input id="kf-telefon" {...feld("telefon")} />
          </FormField>
          <FormField label="Mobil" htmlFor="kf-mobil">
            <Input id="kf-mobil" {...feld("mobil")} />
          </FormField>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-label">Adresse</div>
        <FormField label="Straße und Hausnummer" htmlFor="kf-strasse">
          <Input id="kf-strasse" {...feld("strasse")} />
        </FormField>
        <div className="form-row-plz-ort">
          <FormField label="PLZ" htmlFor="kf-plz">
            <Input id="kf-plz" {...feld("plz")} />
          </FormField>
          <FormField label="Ort" htmlFor="kf-ort">
            <Input id="kf-ort" {...feld("ort")} />
          </FormField>
        </div>
      </div>

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
