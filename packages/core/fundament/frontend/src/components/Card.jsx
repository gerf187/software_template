export default function Card({ title, actions, children }) {
  return (
    <div className="card">
      {title && (
        <div className="card-head">
          <h3>{title}</h3>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}
