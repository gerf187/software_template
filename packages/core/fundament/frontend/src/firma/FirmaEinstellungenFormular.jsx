import { useEffect, useRef, useState } from "react";
import Card from "../components/Card.jsx";
import FormField from "../components/FormField.jsx";
import Input from "../components/Input.jsx";
import Button from "../components/Button.jsx";
import Message from "../components/Message.jsx";
import Spinner from "../components/Spinner.jsx";
import { ladeFirmaEinstellungen, speichereFirmaEinstellungen } from "./api.js";
import { wendeAkzentfarbeAn } from "../theme/akzentfarbe.js";

const STANDARD_AKZENTFARBE = "#2f7d5c";
const LOGO_MAX_BYTES = 200 * 1024;

export default function FirmaEinstellungenFormular({ darfBearbeiten }) {
  const [werte, setWerte] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [erfolg, setErfolg] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const dateiInputRef = useRef(null);

  useEffect(() => {
    ladeFirmaEinstellungen()
      .then((daten) =>
        setWerte({
          name: daten.name || "",
          logo: daten.logo || null,
          akzentfarbe: daten.akzentfarbe || STANDARD_AKZENTFARBE,
        })
      )
      .catch((err) => setFehler(err.message));
  }, []);

  function logoAuswaehlen(e) {
    const datei = e.target.files?.[0];
    if (!datei) return;
    if (datei.size > LOGO_MAX_BYTES) {
      setFehler("Logo ist zu groß (maximal ca. 200 KB).");
      return;
    }
    setFehler(null);
    const leser = new FileReader();
    leser.onload = () => setWerte((w) => ({ ...w, logo: leser.result }));
    leser.readAsDataURL(datei);
  }

  function logoEntfernen() {
    setWerte((w) => ({ ...w, logo: null }));
    if (dateiInputRef.current) dateiInputRef.current.value = "";
  }

  async function absenden(e) {
    e.preventDefault();
    if (!werte.name.trim()) {
      setFehler("Bitte einen Firmennamen angeben.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    setErfolg(false);
    try {
      const gespeichert = await speichereFirmaEinstellungen(werte);
      setWerte({
        name: gespeichert.name || "",
        logo: gespeichert.logo || null,
        akzentfarbe: gespeichert.akzentfarbe || STANDARD_AKZENTFARBE,
      });
      wendeAkzentfarbeAn(gespeichert.akzentfarbe);
      setErfolg(true);
    } catch (err) {
      setFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  if (!werte && !fehler) return <Spinner label="Einstellungen werden geladen …" />;

  return (
    <Card title="Firma">
      {fehler && <Message type="fehler">{fehler}</Message>}
      {erfolg && <Message type="erfolg">Gespeichert.</Message>}
      {werte && (
        <form onSubmit={absenden}>
          <FormField label="Firmenname" htmlFor="fe-name">
            <Input
              id="fe-name"
              value={werte.name}
              onChange={(e) => setWerte((w) => ({ ...w, name: e.target.value }))}
              disabled={!darfBearbeiten}
              required
            />
          </FormField>

          <FormField label="Logo" htmlFor="fe-logo">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {werte.logo && (
                <img
                  src={werte.logo}
                  alt="Logo-Vorschau"
                  style={{
                    height: 40,
                    maxWidth: 160,
                    objectFit: "contain",
                    padding: 6,
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-card)",
                  }}
                />
              )}
              {darfBearbeiten && (
                <>
                  {/* Die Browser-Datei-Auswahl ist unschön und lässt sich nicht stylen:
                      das verborgene Feld öffnet ein Knopf im Design. */}
                  <input
                    ref={dateiInputRef}
                    id="fe-logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={logoAuswaehlen}
                    style={{ display: "none" }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => dateiInputRef.current?.click()}
                  >
                    {werte.logo ? "Logo ersetzen" : "Logo auswählen"}
                  </Button>
                  {werte.logo && (
                    <Button type="button" variant="text" onClick={logoEntfernen}>
                      Logo entfernen
                    </Button>
                  )}
                </>
              )}
            </div>
          </FormField>

          <FormField label="Akzentfarbe" htmlFor="fe-akzentfarbe">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                id="fe-akzentfarbe"
                type="color"
                value={werte.akzentfarbe}
                disabled={!darfBearbeiten}
                onChange={(e) => setWerte((w) => ({ ...w, akzentfarbe: e.target.value }))}
              />
              <code>{werte.akzentfarbe.toUpperCase()}</code>
              {darfBearbeiten && werte.akzentfarbe !== STANDARD_AKZENTFARBE && (
                <Button
                  type="button"
                  variant="text"
                  onClick={() => setWerte((w) => ({ ...w, akzentfarbe: STANDARD_AKZENTFARBE }))}
                >
                  Standardfarbe
                </Button>
              )}
            </div>
          </FormField>

          {darfBearbeiten && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button type="submit" variant="primary" loading={speichert}>
                Speichern
              </Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}
