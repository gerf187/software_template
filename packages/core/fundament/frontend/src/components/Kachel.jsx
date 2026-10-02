import Card from "./Card.jsx";
import { IconEye, IconEyeOff, IconGripVertical, IconArrowsMaximize, IconArrowsMinimize } from "../icons/index.js";

// Baustein einer anpassbaren Startseite (Abschnitt 8/10). Im Bearbeiten-Modus
// kommen Werkzeuge dazu: Ziehgriff (Sortierung per Drag & Drop), Größe
// klein/groß umschalten, ein-/ausblenden. Ausgeblendete Kacheln bleiben im
// Bearbeiten-Modus sichtbar (abgedunkelt), damit man sie wieder einschalten kann.
export default function Kachel({
  titel,
  groesse = "klein",
  sichtbar = true,
  bearbeitenModus = false,
  onSichtbarkeitUmschalten,
  onGroesseUmschalten,
  dragProps,
  children,
}) {
  if (!sichtbar && !bearbeitenModus) return null;

  return (
    <div
      className={`kachel kachel-${groesse}${!sichtbar ? " kachel-ausgeblendet" : ""}`}
      draggable={bearbeitenModus}
      {...dragProps}
    >
      <Card
        title={titel}
        actions={
          bearbeitenModus && (
            <div className="kachel-werkzeuge">
              <span className="kachel-ziehgriff" aria-hidden="true">
                <IconGripVertical />
              </span>
              <button
                type="button"
                className="kachel-werkzeug"
                onClick={onGroesseUmschalten}
                aria-label={groesse === "gross" ? "Verkleinern" : "Vergrößern"}
              >
                {groesse === "gross" ? <IconArrowsMinimize /> : <IconArrowsMaximize />}
              </button>
              <button
                type="button"
                className="kachel-werkzeug"
                onClick={onSichtbarkeitUmschalten}
                aria-label={sichtbar ? "Ausblenden" : "Einblenden"}
              >
                {sichtbar ? <IconEye /> : <IconEyeOff />}
              </button>
            </div>
          )
        }
      >
        {sichtbar ? children : <p className="kachel-ausgeblendet-hinweis">Ausgeblendet.</p>}
      </Card>
    </div>
  );
}
