async function anfrage(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const daten = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(daten.error || "Anfrage fehlgeschlagen.");
  return daten;
}

export const ladeKachelLayout = () => anfrage("GET", "/api/dashboard/layout");
export const speichereKachelLayout = (layout) =>
  anfrage("PUT", "/api/dashboard/layout", { layout });
export const setzeFirmenStandard = () => anfrage("POST", "/api/dashboard/layout/standard");
export const setzeLayoutZurueck = () => anfrage("DELETE", "/api/dashboard/layout");
export const ladeDashboardDaten = () => anfrage("GET", "/api/dashboard/daten");
