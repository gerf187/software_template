import { useLayoutEffect, useRef, useState } from "react";
import Button from "./Button.jsx";
import { IconDots } from "../icons/index.js";
import { sichtbareNebenaktionen } from "./pageHeaderUeberlauf.js";

function pxGap(element) {
  if (!element) return 0;
  return parseFloat(getComputedStyle(element).gap) || 0;
}

// sekundaer: Nebenaktionen als Liste { label, onClick }. Was bei der aktuellen
// Breite nicht mehr neben den Titel passt, wandert ins "⋯"-Menü -- bei jeder
// Bildschirmbreite, nicht nur auf dem Handy (Abschnitt 9, Punkt 0.3). actions
// bleibt immer sichtbar (Hauptaktion).
export default function PageHeader({ title, meta, actions, sekundaer = [] }) {
  const [menuOffen, setMenuOffen] = useState(false);
  const [sichtbareAnzahl, setSichtbareAnzahl] = useState(sekundaer.length);

  const headerRef = useRef(null);
  const titleRef = useRef(null);
  const metaRef = useRef(null);
  const actionsRef = useRef(null);
  const mehrKnopfMessRef = useRef(null);
  const messRefs = useRef([]);

  useLayoutEffect(() => {
    if (sekundaer.length === 0) {
      setSichtbareAnzahl(0);
      return;
    }

    function neuBerechnen() {
      const header = headerRef.current;
      if (!header) return;
      const headerBreite = header.clientWidth;
      const titelBreite = titleRef.current?.offsetWidth ?? 0;
      const rechtsLuecke = pxGap(header);
      const innenLuecke = pxGap(header.querySelector(".page-header-right"));

      const rechtsBudget = headerBreite - titelBreite - rechtsLuecke;
      const metaBreite = metaRef.current?.offsetWidth ?? 0;
      const aktionenBreite = actionsRef.current?.offsetWidth ?? 0;
      const fixeAnzahl = (metaRef.current ? 1 : 0) + (actionsRef.current ? 1 : 0);

      const verfuegbar = rechtsBudget - metaBreite - aktionenBreite - innenLuecke * fixeAnzahl;
      const breiten = messRefs.current.map((el) => el?.offsetWidth ?? 0);
      const mehrKnopfBreite = mehrKnopfMessRef.current?.offsetWidth ?? 0;

      setSichtbareAnzahl(
        sichtbareNebenaktionen({ verfuegbar, breiten, mehrKnopfBreite, luecke: innenLuecke })
      );
    }

    neuBerechnen();
    const beobachter = new ResizeObserver(neuBerechnen);
    if (headerRef.current) beobachter.observe(headerRef.current);
    return () => beobachter.disconnect();
    // sekundaer.length statt sekundaer: die Liste wird oft neu erzeugt, die Länge
    // (und die Beschriftungen, die die Breiten beeinflussen) reicht als Auslöser.
  }, [sekundaer.length, sekundaer.map((a) => a.label).join("|")]);

  const sichtbar = sekundaer.slice(0, sichtbareAnzahl);
  const imMenu = sekundaer.slice(sichtbareAnzahl);

  return (
    <div className="page-header" ref={headerRef}>
      <h1 ref={titleRef}>{title}</h1>
      <div className="page-header-right">
        {meta && (
          <span className="page-header-meta" ref={metaRef}>
            {meta}
          </span>
        )}
        {sekundaer.length > 0 && (
          <>
            <div className="page-header-sekundaer">
              {sichtbar.map((aktion) => (
                <Button key={aktion.label} variant="secondary" onClick={aktion.onClick}>
                  {aktion.label}
                </Button>
              ))}
            </div>
            {imMenu.length > 0 && (
              <div className="page-header-mehr">
                <Button
                  variant="secondary"
                  className="page-header-mehr-knopf"
                  aria-label="Weitere Aktionen"
                  aria-expanded={menuOffen}
                  onClick={() => setMenuOffen(!menuOffen)}
                >
                  <IconDots />
                </Button>
                {menuOffen && (
                  <div className="page-header-mehr-liste">
                    {imMenu.map((aktion) => (
                      <Button
                        key={aktion.label}
                        variant="text"
                        onClick={() => {
                          setMenuOffen(false);
                          aktion.onClick();
                        }}
                      >
                        {aktion.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Unsichtbare Messzeile: liefert die echten Breiten aller Nebenaktionen
                und des "⋯"-Knopfs, ohne das Layout zu beeinflussen. */}
            <div className="page-header-sekundaer page-header-mess" aria-hidden="true">
              {sekundaer.map((aktion, i) => (
                <Button key={aktion.label} variant="secondary" ref={(el) => (messRefs.current[i] = el)}>
                  {aktion.label}
                </Button>
              ))}
              <Button variant="secondary" className="page-header-mehr-knopf" ref={mehrKnopfMessRef}>
                <IconDots />
              </Button>
            </div>
          </>
        )}
        {actions && <div ref={actionsRef}>{actions}</div>}
      </div>
    </div>
  );
}
