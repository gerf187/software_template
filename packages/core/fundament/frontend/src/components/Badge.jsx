export default function Badge({ status = "accent", pill = false, children }) {
  return (
    <span className={`badge badge-${status}${pill ? " badge-pill" : ""}`}>
      {children}
    </span>
  );
}
