import { useState } from "react";
import FormField from "@fundament/frontend/src/components/FormField.jsx";
import Input from "@fundament/frontend/src/components/Input.jsx";
import Select from "@fundament/frontend/src/components/Select.jsx";
import Checkbox from "@fundament/frontend/src/components/Checkbox.jsx";
import Button from "@fundament/frontend/src/components/Button.jsx";
import Message from "@fundament/frontend/src/components/Message.jsx";
import { pruefePlz } from "@fundament/backend/src/validierung/plz.js";
import appConfig from "~app-config";
import { vorschlagProjektname } from "./namensvorschlag.js";

const PROJEKTE_CONFIG = appConfig.projekte || { projektarten: [], status: [], phasen: [] };

function ausProjekt(projekt, kontakt) {
  if (!projekt) {
    return {
      name: "",
      arten: [],
      status: PROJEKTE_CONFIG.status.find((s) => !s.nurAutomatisch)?.label || "",
      phase: PROJEKTE_CONFIG.phasen[0] || "",
      strasse: kontakt?.wohnadresse_strasse || "",
      plz: kontakt?.wohnadresse_plz || "",
      ort: kontakt?.wohnadresse_ort || "",
      auftragsdatum: "",
      ablageLink: "",
      pausiertGrund: "",
    };
  }
  return {
    name: projekt.name,
    arten: projekt.arten || [],
    status: projekt.status,
    phase: projekt.phase,
    strasse: projekt.objektadresseStrasse || "",
    plz: projekt.objektadressePlz || "",
    ort: projekt.objektadresseOrt || "",
    auftragsdatum: projekt.auftragsdatum ? projekt.auftragsdatum.slice(0, 10) : "",
    ablageLink: projekt.ablageLink || "",
    pausiertGrund: projekt.pausiertGrund || "",
  };
}

// Anlegen und Bearbeiten (Teil 1, Punkt 4/6). Beim Anlegen schlägt der
// Projektname sich selbst vor, solange er nicht von Hand geändert wurde
// (Teil 1, Punkt 3).
export default function ProjektFormular({ kontakt, projekt, onSpeichern, onAbbrechen }) {
  const [werte, setWerte] = useState(() => ausProjekt(projekt, kontakt));
  const [nameEigenstaendig, setNameEigenstaendig] = useState(!!projekt);
  const [fehler, setFehler] = useState(null);
  const [speichert, setSpeichert] = useState(false);

  const statusEintrag = PROJEKTE_CONFIG.status.find((s) => s.label === werte.status);

  function artenUmschalten(art) {
    setWerte((w) => {
      const arten = w.arten.includes(art) ? w.arten.filter((a) => a !== art) : [...w.arten, art];
      const neu = { ...w, arten };
      if (!nameEigenstaendig) {
        neu.name = vorschlagProjektname({ kontakt, arten, objektadresseOrt: w.ort });
      }
      return neu;
    });
  }

  function ortAendern(ort) {
    setWerte((w) => {
      const neu = { ...w, ort };
      if (!nameEigenstaendig) {
        neu.name = vorschlagProjektname({ kontakt, arten: w.arten, objektadresseOrt: ort });
      }
      return neu;
    });
  }

  function adresseUebernehmen() {
    ortAendern(kontakt?.wohnadresse_ort || "");
    setWerte((w) => ({
      ...w,
      strasse: kontakt?.wohnadresse_strasse || "",
      plz: kontakt?.wohnadresse_plz || "",
    }));
  }

  async function absenden(e) {
    e.preventDefault();
    // Gleiche Regeln wie im Backend (validierung.js) -- dort wird zusätzlich geprüft.
    if (werte.arten.length === 0) {
      setFehler("Bitte mindestens eine Projektart auswählen.");
      return;
    }
    const plzFehler = pruefePlz(werte.plz);
    if (plzFehler) {
      setFehler(plzFehler);
      return;
    }
    // Leerer Name wird aus dem Vorschlag erzeugt (Platzhalter sagt das an).
    const name = werte.name.trim() || vorschlagProjektname({ kontakt, arten: werte.arten, objektadresseOrt: werte.ort });
    if (!name) {
      setFehler("Bitte einen Projektnamen angeben.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      await onSpeichern({
        name,
        arten: werte.arten,
        status: werte.status,
        phase: werte.phase,
        objektadresseStrasse: werte.strasse,
        objektadressePlz: werte.plz,
        objektadresseOrt: werte.ort,
        auftragsdatum: werte.auftragsdatum || null,
        ablageLink: werte.ablageLink || null,
        pausiertGrund: statusEintrag?.grundPflicht ? werte.pausiertGrund : null,
      });
    } catch (err) {
      setFehler(err.message);
      setSpeichert(false);
    }
  }

  // Status-Optionen: "nurAutomatisch" (z. B. Pausiert Eskalation) ist nie von
  // Hand wählbar -- nur anzeigen, wenn ein bestehendes Projekt schon so
  // automatisch gesetzt wurde (sonst verschwände der Wert beim Bearbeiten).
  const statusOptionen = PROJEKTE_CONFIG.status.filter(
    (s) => !s.nurAutomatisch || s.label === projekt?.status
  );

  return (
    <form onSubmit={absenden}>
      {fehler && <Message type="fehler">{fehler}</Message>}

      <FormField label="Projektname" htmlFor="pf-name">
        <Input
          id="pf-name"
          value={werte.name}
          placeholder="wird automatisch erzeugt"
          onChange={(e) => {
            // Feld geleert -> wieder automatischer Vorschlag.
            setNameEigenstaendig(e.target.value.trim() !== "");
            setWerte((w) => ({ ...w, name: e.target.value }));
          }}
        />
      </FormField>

      <div className="form-section">
        <div className="form-section-label">Projektart</div>
        {PROJEKTE_CONFIG.projektarten.map((art) => (
          <Checkbox
            key={art}
            label={art}
            checked={werte.arten.includes(art)}
            onChange={() => artenUmschalten(art)}
          />
        ))}
      </div>

      <div className="form-grid">
        <FormField label="Phase" htmlFor="pf-phase">
          <Select id="pf-phase" value={werte.phase} onChange={(e) => setWerte((w) => ({ ...w, phase: e.target.value }))}>
            {PROJEKTE_CONFIG.phasen.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status" htmlFor="pf-status">
          <Select id="pf-status" value={werte.status} onChange={(e) => setWerte((w) => ({ ...w, status: e.target.value }))}>
            {statusOptionen.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {statusEintrag?.grundPflicht && (
        <FormField label="Grund der Pausierung" htmlFor="pf-pausiert-grund">
          <Input
            id="pf-pausiert-grund"
            value={werte.pausiertGrund}
            onChange={(e) => setWerte((w) => ({ ...w, pausiertGrund: e.target.value }))}
            required
          />
        </FormField>
      )}

      <div className="form-section">
        <div className="form-section-label">Objektadresse</div>
        {kontakt && (
          <Button type="button" variant="secondary" onClick={adresseUebernehmen}>
            Adresse des Kontakts übernehmen
          </Button>
        )}
        <FormField label="Straße und Hausnummer" htmlFor="pf-strasse">
          <Input id="pf-strasse" value={werte.strasse} onChange={(e) => setWerte((w) => ({ ...w, strasse: e.target.value }))} />
        </FormField>
        <div className="form-row-plz-ort">
          <FormField label="PLZ" htmlFor="pf-plz">
            <Input id="pf-plz" value={werte.plz} onChange={(e) => setWerte((w) => ({ ...w, plz: e.target.value }))} />
          </FormField>
          <FormField label="Ort" htmlFor="pf-ort">
            <Input id="pf-ort" value={werte.ort} onChange={(e) => ortAendern(e.target.value)} />
          </FormField>
        </div>
      </div>

      <div className="form-grid">
        <FormField label={PROJEKTE_CONFIG.auftragsdatumLabel || "Auftragsdatum"} htmlFor="pf-auftragsdatum">
          <Input
            id="pf-auftragsdatum"
            type="date"
            value={werte.auftragsdatum}
            onChange={(e) => setWerte((w) => ({ ...w, auftragsdatum: e.target.value }))}
          />
        </FormField>
        <FormField label="Ablage-Link" htmlFor="pf-ablage-link">
          <Input
            id="pf-ablage-link"
            type="url"
            placeholder="https://…"
            value={werte.ablageLink}
            onChange={(e) => setWerte((w) => ({ ...w, ablageLink: e.target.value }))}
          />
        </FormField>
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
