export async function ladeDashboard() {
  const res = await fetch("/api/dashboard");
  const daten = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(daten.error || "Dashboard konnte nicht geladen werden.");
  return daten;
}
