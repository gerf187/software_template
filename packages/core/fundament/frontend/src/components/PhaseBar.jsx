// onPhaseClick (Teil 1, Punkt 6): Phase per Klick vor und zurück setzen --
// ohne die Funktion bleibt die Leiste eine reine Anzeige (z. B. woanders
// noch ohne Bearbeiten-Recht).
export default function PhaseBar({ phases, active, onPhaseClick }) {
  const activeIndex = phases.indexOf(active);
  const Element = onPhaseClick ? "button" : "span";

  return (
    <div className="phase-bar">
      {phases.map((phase, index) => (
        <Element
          key={phase}
          type={onPhaseClick ? "button" : undefined}
          className={
            "phase-bar-step" +
            (onPhaseClick ? " phase-bar-step-klickbar" : "") +
            (index === activeIndex ? " phase-bar-step-active" : "") +
            (index < activeIndex ? " phase-bar-step-done" : "")
          }
          onClick={onPhaseClick ? () => onPhaseClick(phase) : undefined}
        >
          {phase}
        </Element>
      ))}
    </div>
  );
}
