// Leerzustand (Abschnitt 9): sagt, was hier erscheint -- optional mit
// Button, wie man startet (z. B. "Noch keine Kontakte" + "Kontakt anlegen").
export default function EmptyState({ children, action }) {
  if (!action) return <p className="empty-state">{children}</p>;
  return (
    <div className="empty-state">
      <p>{children}</p>
      {action}
    </div>
  );
}
