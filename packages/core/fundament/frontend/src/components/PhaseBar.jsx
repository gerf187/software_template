export default function PhaseBar({ phases, active }) {
  const activeIndex = phases.indexOf(active);

  return (
    <div className="phase-bar">
      {phases.map((phase, index) => (
        <span
          key={phase}
          className={
            "phase-bar-step" +
            (index === activeIndex ? " phase-bar-step-active" : "") +
            (index < activeIndex ? " phase-bar-step-done" : "")
          }
        >
          {phase}
        </span>
      ))}
    </div>
  );
}
