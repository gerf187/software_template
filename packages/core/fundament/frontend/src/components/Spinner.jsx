export default function Spinner({ label = "Lädt …" }) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <span className="spinner-circle" />
      <span>{label}</span>
    </div>
  );
}
