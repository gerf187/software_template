export default function FormField({ label, error, htmlFor, children }) {
  return (
    <div className="form-field">
      <label className="form-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <p className="form-field-error">{error}</p>}
    </div>
  );
}
