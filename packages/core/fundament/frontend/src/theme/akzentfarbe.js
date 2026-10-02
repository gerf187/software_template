// Akzentfarbe ist per Firma überschreibbar (Anhang A.1: --accent und
// --bg-sidebar-active sind als "= Akzent" markiert). Status-Farben wie
// --success bleiben unabhängig davon immer grün.
export function wendeAkzentfarbeAn(hex) {
  const wurzel = document.documentElement.style;
  if (!hex) {
    wurzel.removeProperty("--accent");
    wurzel.removeProperty("--accent-soft");
    wurzel.removeProperty("--bg-sidebar-active");
    return;
  }
  wurzel.setProperty("--accent", hex);
  wurzel.setProperty("--bg-sidebar-active", hex);
  wurzel.setProperty("--accent-soft", `color-mix(in srgb, ${hex} 18%, white)`);
}
