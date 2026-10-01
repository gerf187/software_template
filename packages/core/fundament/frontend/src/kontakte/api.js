async function verarbeiten(res) {
  if (!res.ok) {
    const daten = await res.json().catch(() => ({}));
    throw new Error(daten.error || "Anfrage fehlgeschlagen.");
  }
  if (res.status === 204) return null;
  return res.json();
}

function anfrage(method, path, body) {
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(verarbeiten);
}

export const listeKontakte = (suche = "") =>
  anfrage("GET", `/api/kontakte${suche ? `?q=${encodeURIComponent(suche)}` : ""}`);
export const holeKontakt = (id) => anfrage("GET", `/api/kontakte/${id}`);
export const legeKontaktAn = (daten) => anfrage("POST", "/api/kontakte", daten);
export const speichereKontakt = (id, daten) => anfrage("PUT", `/api/kontakte/${id}`, daten);
export const loescheKontakt = (id) => anfrage("DELETE", `/api/kontakte/${id}`);

export const listeNotizen = (id) => anfrage("GET", `/api/kontakte/${id}/notizen`);
export const legeNotizAn = (id, text) => anfrage("POST", `/api/kontakte/${id}/notizen`, { text });

export const listeAufgaben = (id) => anfrage("GET", `/api/kontakte/${id}/aufgaben`);
export const legeAufgabeAn = (id, text, faelligAm) =>
  anfrage("POST", `/api/kontakte/${id}/aufgaben`, { text, faelligAm: faelligAm || null });
export const setzeAufgabeErledigt = (id, aufgabeId, erledigt) =>
  anfrage("PATCH", `/api/kontakte/${id}/aufgaben/${aufgabeId}`, { erledigt });

export const holeVerlauf = (id) => anfrage("GET", `/api/kontakte/${id}/verlauf`);

export async function exportiereKontakt(id) {
  const res = await fetch(`/api/kontakte/${id}/export`);
  if (!res.ok) throw new Error("Export fehlgeschlagen.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kontakt-${id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
