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

function query(filter) {
  const teile = Object.entries(filter || {}).filter(([, wert]) => wert);
  if (teile.length === 0) return "";
  return "?" + teile.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

export const listeProjekte = (filter) => anfrage("GET", `/api/module/projekte/${query(filter)}`);
export const holeProjekt = (id) => anfrage("GET", `/api/module/projekte/${id}`);
export const legeProjektAn = (daten) => anfrage("POST", "/api/module/projekte/", daten);
export const speichereProjekt = (id, daten) => anfrage("PUT", `/api/module/projekte/${id}`, daten);
export const setzePhase = (id, phase) => anfrage("PATCH", `/api/module/projekte/${id}/phase`, { phase });
export const loescheProjekt = (id) => anfrage("DELETE", `/api/module/projekte/${id}`);
export const listeProjekteVonKontakt = (kontaktId) =>
  anfrage("GET", `/api/module/projekte/kontakte/${kontaktId}`);
export const holeProjektVerlauf = (id) => anfrage("GET", `/api/module/projekte/${id}/verlauf`);

export const listeProjektNotizen = (id) => anfrage("GET", `/api/module/projekte/${id}/notizen`);
export const legeProjektNotizAn = (id, text) =>
  anfrage("POST", `/api/module/projekte/${id}/notizen`, { text });

export const listeProjektAufgaben = (id) => anfrage("GET", `/api/module/projekte/${id}/aufgaben`);
export const legeProjektAufgabeAn = (id, text, faelligAm) =>
  anfrage("POST", `/api/module/projekte/${id}/aufgaben`, { text, faelligAm: faelligAm || null });
export const setzeProjektAufgabeErledigt = (id, aufgabeId, erledigt) =>
  anfrage("PATCH", `/api/module/projekte/${id}/aufgaben/${aufgabeId}`, { erledigt });
export const holeZuletztBearbeiteteProjekte = () =>
  anfrage("GET", "/api/module/projekte/kacheln/zuletzt-bearbeitet");
