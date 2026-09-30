export default function DeadlineBar({ percent }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const status = clamped >= 90 ? "danger" : clamped >= 60 ? "warn" : "success";

  return (
    <div className="deadline-bar">
      <div
        className={`deadline-bar-fill deadline-bar-fill-${status}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
