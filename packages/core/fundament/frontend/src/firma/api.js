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

export const ladeFirmaEinstellungen = () => anfrage("GET", "/api/firma/einstellungen");
export const speichereFirmaEinstellungen = (daten) =>
  anfrage("PUT", "/api/firma/einstellungen", daten);
