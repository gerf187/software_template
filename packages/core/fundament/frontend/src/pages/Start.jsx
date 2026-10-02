import { useEffect, useRef, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import Button from "../components/Button.jsx";
import Kachel from "../components/Kachel.jsx";
import Message from "../components/Message.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  ladeKachelLayout,
  speichereKachelLayout,
  setzeFirmenStandard,
  setzeLayoutZurueck,
  ladeDashboardDaten,
} from "../dashboard/api.js";
import { kachelKomponente } from "../dashboard/kachelRegistry.js";

export default function Start() {
  const { user } = useAuth();
  const [layout, setLayout] = useState(undefined);
  const [daten, setDaten] = useState(undefined);
  const [fehler, setFehler] = useState(null);
  const [bearbeitenModus, setBearbeitenModus] = useState(false);
  const [entwurf, setEntwurf] = useState([]);
  const [speichert, setSpeichert] = useState(false);
  const ziehIndexRef = useRef(null);

  function laden() {
    Promise.all([ladeKachelLayout(), ladeDashboardDaten()])
      .then(([layoutDaten, inhaltsDaten]) => {
        setLayout(layoutDaten);
        setDaten(inhaltsDaten);
      })
      .catch((err) => setFehler(err.message));
  }

  useEffect(laden, []);

  function anpassenStarten() {
    setEntwurf(layout);
    setBearbeitenModus(true);
  }

  function abbrechen() {
    setBearbeitenModus(false);
  }

  async function fertig() {
    setSpeichert(true);
    try {
      const ergebnis = await speichereKachelLayout(
        entwurf.map(({ key, sichtbar, groesse }) => ({ key, sichtbar, groesse }))
      );
      setLayout(ergebnis);
      setBearbeitenModus(false);
    } catch (err) {
      setFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  async function zuruecksetzen() {
    try {
      const ergebnis = await setzeLayoutZurueck();
      setLayout(ergebnis);
      setBearbeitenModus(false);
    } catch (err) {
      setFehler(err.message);
    }
  }

  async function alsFirmenStandard() {
    try {
      await setzeFirmenStandard();
    } catch (err) {
      setFehler(err.message);
    }
  }

  function sichtbarkeitUmschalten(key) {
    setEntwurf((liste) =>
      liste.map((k) => (k.key === key ? { ...k, sichtbar: !k.sichtbar } : k))
    );
  }

  function groesseUmschalten(key) {
    setEntwurf((liste) =>
      liste.map((k) => (k.key === key ? { ...k, groesse: k.groesse === "gross" ? "klein" : "gross" } : k))
    );
  }

  function dragPropsFuer(index) {
    return {
      onDragStart: () => {
        ziehIndexRef.current = index;
      },
      onDragOver: (e) => e.preventDefault(),
      onDrop: (e) => {
        e.preventDefault();
        const von = ziehIndexRef.current;
        if (von === null || von === index) return;
        setEntwurf((liste) => {
          const kopie = [...liste];
          const [verschoben] = kopie.splice(von, 1);
          kopie.splice(index, 0, verschoben);
          return kopie;
        });
        ziehIndexRef.current = index;
      },
    };
  }

  const darfAlsStandardFestlegen = !!user?.rechte?.einstellungen?.bearbeiten;
  const angezeigt = bearbeitenModus ? entwurf : layout;

  return (
    <div>
      <PageHeader
        title="Start"
        meta={user?.firma?.name || undefined}
        actions={
          layout !== undefined && (
            <>
              {bearbeitenModus ? (
                <>
                  <Button variant="text" onClick={abbrechen}>
                    Abbrechen
                  </Button>
                  <Button variant="primary" onClick={fertig} loading={speichert}>
                    Fertig
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={zuruecksetzen}>
                    Auf Standard zurücksetzen
                  </Button>
                  {darfAlsStandardFestlegen && (
                    <Button variant="secondary" onClick={alsFirmenStandard}>
                      Als Firmen-Standard festlegen
                    </Button>
                  )}
                  <Button variant="primary" onClick={anpassenStarten}>
                    Anpassen
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      {fehler && <Message type="fehler">{fehler}</Message>}
      {!fehler && layout === undefined && <Spinner label="Wird geladen …" />}

      {!fehler && layout !== undefined && angezeigt.length === 0 && (
        <EmptyState>Noch nichts zum Anzeigen.</EmptyState>
      )}

      {!fehler && layout !== undefined && angezeigt.length > 0 && (
        <div className="kachel-grid">
          {angezeigt.map((eintrag, index) => {
            const Komponente = kachelKomponente(eintrag.key);
            return (
              <Kachel
                key={eintrag.key}
                titel={eintrag.titel}
                groesse={eintrag.groesse}
                sichtbar={eintrag.sichtbar}
                bearbeitenModus={bearbeitenModus}
                onSichtbarkeitUmschalten={() => sichtbarkeitUmschalten(eintrag.key)}
                onGroesseUmschalten={() => groesseUmschalten(eintrag.key)}
                dragProps={bearbeitenModus ? dragPropsFuer(index) : undefined}
              >
                {Komponente ? <Komponente daten={daten} user={user} /> : null}
              </Kachel>
            );
          })}
        </div>
      )}
    </div>
  );
}
