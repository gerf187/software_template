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

export const listeMitarbeiter = () => anfrage("GET", "/api/mitarbeiter");
export const ladeMitarbeiterEinladen = (daten) => anfrage("POST", "/api/mitarbeiter", daten);
export const speichereMitarbeiter = (id, daten) => anfrage("PUT", `/api/mitarbeiter/${id}`, daten);
export const setzeMitarbeiterAktiv = (id, aktiv) =>
  anfrage("PATCH", `/api/mitarbeiter/${id}/aktiv`, { aktiv });
export const loescheMitarbeiterEndgueltig = (id) => anfrage("DELETE", `/api/mitarbeiter/${id}`);
