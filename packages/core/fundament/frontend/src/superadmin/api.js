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

export const listeFirmen = () => anfrage("GET", "/api/superadmin/firmen");
export const legeFirmaAn = (daten) => anfrage("POST", "/api/superadmin/firmen", daten);
export const setzeFirmaAktiv = (id, aktiv) =>
  anfrage("PATCH", `/api/superadmin/firmen/${id}`, { aktiv });
export const ladeFirmaEinladen = (id, daten) =>
  anfrage("POST", `/api/superadmin/firmen/${id}/einladen`, daten);
export const listeModule = (firmaId) => anfrage("GET", `/api/superadmin/firmen/${firmaId}/module`);
export const setzeModulAktiv = (firmaId, modul, aktiv) =>
  anfrage("PATCH", `/api/superadmin/firmen/${firmaId}/module/${modul}`, { aktiv });
