import EmptyState from "../../components/EmptyState.jsx";
import { protokollTabellenText, protokollNamensfeld } from "../../module/registry.js";

// Nur Fundament-Tabellen -- Bausteine melden ihre eigenen über
// modul.config.js an (protokollTabellen), das Fundament kennt sie nicht.
const TABELLE_TEXT = {
  contacts: "Kontakt",
  notes: "Notiz",
  tasks: "Aufgabe",
  users: "Mitarbeiter",
  rechte: "Recht",
  firma_module: "Baustein-Freischaltung",
};

function tabelleText(tabelle) {
  return TABELLE_TEXT[tabelle] || protokollTabellenText(tabelle) || "Eintrag";
}

// Anzeigename des Datensatzes (Teil C, Punkt C5), z. B. 'Projekt „Schulz –
// Typ B" geändert'. Fundament-Tabellen lösen das selbst auf (eigene Felder,
// bei Kontakten mehrere möglich), Bausteine melden ihr Namensfeld an
// (protokollTabellen, Feld "namensfeld").
const FUNDAMENT_NAME_AUS_WERTEN = {
  contacts: (w) => [w.vorname, w.nachname].filter(Boolean).join(" ") || w.organisation || null,
  notes: (w) => w.text || null,
  tasks: (w) => w.text || null,
  users: (w) => w.name || null,
  firma_module: (w) => w.modul || null,
};

function anzeigeName(eintrag) {
  const werte = eintrag.neueWerte || eintrag.alteWerte;
  if (!werte) return null;
  const fundamentFn = FUNDAMENT_NAME_AUS_WERTEN[eintrag.tabelle];
  if (fundamentFn) return fundamentFn(werte);
  const feld = protokollNamensfeld(eintrag.tabelle);
  return feld ? werte[feld] || null : null;
}

const AKTION_TEXT = { angelegt: "angelegt", geaendert: "geändert", geloescht: "gelöscht" };

export default function LetzteAktivitaeten({ daten }) {
  const eintraege = daten?.letzteAktivitaeten || [];

  if (eintraege.length === 0) return <EmptyState>Noch keine Änderungen protokolliert.</EmptyState>;

  return (
    <div>
      {eintraege.map((e) => {
        const name = anzeigeName(e);
        return (
          <p key={e.id} style={{ margin: "0 0 8px" }}>
            {tabelleText(e.tabelle)} {name && `„${name}" `}
            {AKTION_TEXT[e.aktion] || e.aktion} am {new Date(e.zeitpunkt).toLocaleString("de-DE")}
            {e.benutzerName ? ` von ${e.benutzerName}` : ""}
          </p>
        );
      })}
    </div>
  );
}
