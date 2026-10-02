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

export const listeBenutzer = () => anfrage("GET", "/api/benutzer");
export const ladeBenutzerEinladen = (daten) => anfrage("POST", "/api/benutzer", daten);
export const speichereBenutzer = (id, daten) => anfrage("PUT", `/api/benutzer/${id}`, daten);
export const setzeBenutzerAktiv = (id, aktiv) =>
  anfrage("PATCH", `/api/benutzer/${id}/aktiv`, { aktiv });
