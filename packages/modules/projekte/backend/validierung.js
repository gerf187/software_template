// Geschäftsregeln rund ums Projekt (Teil 1, Punkt 2), geprüft gegen die
// App-Konfiguration (app.config.js, Feld "projekte") -- der Baustein selbst
// kennt keine festen Projektarten/Status/Phasen (Abschnitt 8).

export function projektFelder(body) {
  return {
    name: (body.name || "").trim(),
    arten: Array.isArray(body.arten) ? body.arten.filter((a) => typeof a === "string" && a) : [],
    status: body.status || "",
    phase: body.phase || "",
    objektadresse_strasse: body.objektadresseStrasse || null,
    objektadresse_plz: body.objektadressePlz || null,
    objektadresse_ort: body.objektadresseOrt || null,
    auftragsdatum: body.auftragsdatum || null,
    ablage_link: body.ablageLink || null,
    pausiert_grund: body.pausiertGrund || null,
  };
}

// Liefert eine Fehlermeldung (String) oder null, wenn alles passt.
export function pruefeProjektFelder(felder, config) {
  if (!felder.name) return "Bitte einen Projektnamen angeben.";

  const projektarten = config?.projektarten || [];
  for (const art of felder.arten) {
    if (!projektarten.includes(art)) return `Unbekannte Projektart: "${art}".`;
  }

  const statusEintrag = (config?.status || []).find((s) => s.label === felder.status);
  if (!statusEintrag) return "Bitte einen gültigen Status angeben.";
  if (statusEintrag.nurAutomatisch) {
    return `Status "${felder.status}" kann nicht von Hand gesetzt werden.`;
  }
  if (statusEintrag.grundPflicht && !felder.pausiert_grund?.trim()) {
    return "Bitte einen Grund für die Pausierung angeben.";
  }

  const phasen = config?.phasen || [];
  if (!phasen.includes(felder.phase)) return "Bitte eine gültige Phase angeben.";

  if (felder.ablage_link && !/^https?:\/\//i.test(felder.ablage_link)) {
    return "Der Ablage-Link muss mit http:// oder https:// beginnen.";
  }

  return null;
}

// Für die eigenständige Phase-Änderung (Phasen-Leiste, Klick vor/zurück).
export function pruefePhase(phase, config) {
  if (!(config?.phasen || []).includes(phase)) return "Bitte eine gültige Phase angeben.";
  return null;
}
