import { useState } from "react";
import Button from "./Button.jsx";
import { IconDots } from "../icons/index.js";

// sekundaer: Nebenaktionen als Liste { label, onClick }. Auf breiten Bildschirmen
// stehen sie als Knöpfe da, auf dem Handy nur hinter dem "⋯"-Menü (CSS).
// actions bleibt immer sichtbar (Hauptaktion).
export default function PageHeader({ title, meta, actions, sekundaer = [] }) {
  const [menuOffen, setMenuOffen] = useState(false);

  return (
    <div className="page-header">
      <h1>{title}</h1>
      <div className="page-header-right">
        {meta && <span className="page-header-meta">{meta}</span>}
        {sekundaer.length > 0 && (
          <>
            <div className="page-header-sekundaer">
              {sekundaer.map((aktion) => (
                <Button key={aktion.label} variant="secondary" onClick={aktion.onClick}>
                  {aktion.label}
                </Button>
              ))}
            </div>
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
                  {sekundaer.map((aktion) => (
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
          </>
        )}
        {actions}
      </div>
    </div>
  );
}
