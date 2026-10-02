import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "./Input.jsx";
import Spinner from "./Spinner.jsx";
import { IconSearch } from "../icons/index.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";

async function sucheAnfrage(q) {
  const res = await fetch(`/api/suche?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

// Globale Suche (Abschnitt 2, Fundament): wie jedes Suchfeld ohne Button,
// lädt 250 ms nach der letzten Eingabe automatisch (Abschnitt 9).
export default function GlobaleSuche() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const verzoegert = useDebouncedValue(text);
  const [ergebnisse, setErgebnisse] = useState([]);
  const [laedt, setLaedt] = useState(false);
  const [offen, setOffen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const q = verzoegert.trim();
    if (q.length < 2) {
      setErgebnisse([]);
      return;
    }
    setLaedt(true);
    sucheAnfrage(q)
      .then(setErgebnisse)
      .finally(() => setLaedt(false));
  }, [verzoegert]);

  useEffect(() => {
    function aussenKlick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOffen(false);
    }
    document.addEventListener("mousedown", aussenKlick);
    return () => document.removeEventListener("mousedown", aussenKlick);
  }, []);

  function ergebnisWaehlen(treffer) {
    navigate(treffer.to);
    setText("");
    setErgebnisse([]);
    setOffen(false);
  }

  const zeigeErgebnisse = offen && text.trim().length >= 2;

  return (
    <div className="globale-suche" ref={boxRef}>
      <div className="globale-suche-feld">
        <IconSearch className="globale-suche-icon" />
        <Input
          placeholder="Suche …"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOffen(true);
          }}
          onFocus={() => setOffen(true)}
        />
      </div>
      {zeigeErgebnisse && (
        <div className="globale-suche-ergebnisse">
          {laedt && <Spinner label="Suche …" />}
          {!laedt && ergebnisse.length === 0 && (
            <p className="globale-suche-leer">Keine Treffer.</p>
          )}
          {!laedt &&
            ergebnisse.map((treffer) => (
              <button
                key={`${treffer.typ}-${treffer.id}`}
                type="button"
                className="globale-suche-treffer"
                onClick={() => ergebnisWaehlen(treffer)}
              >
                <span className="globale-suche-treffer-titel">{treffer.titel}</span>
                {treffer.untertitel && (
                  <span className="globale-suche-treffer-untertitel">{treffer.untertitel}</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
