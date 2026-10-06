// Akzentfarbe aus dem Logo vorschlagen. Die Rechenfunktionen hier sind rein (ohne
// Browser) und werden getestet. farbeAusBild liest das Bild im Browser über Canvas.
// Keine externe Bibliothek, kein externer Dienst.

const WEISS = "#ffffff";
const MIN_KONTRAST = 4.5; // WCAG AA für normalen Text

const hex2 = (n) => Math.round(n).toString(16).padStart(2, "0");
const hexVon = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const rgbVon = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Pixel, die als Akzent nicht taugen: transparent, Grautöne, fast schwarz, fast weiß.
function istBrauchbar(r, g, b, a) {
  if (a < 128) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 24) return false; // kaum Farbton: Grau, Schwarz, Weiß
  if (max < 40 || min > 230) return false;
  return true;
}

// Häufigste Farbe (grob einsortiert, dann gemittelt). Ohne brauchbare Pixel: null.
export function hauptfarbe(pixel) {
  const felder = new Map();
  for (let i = 0; i < pixel.length; i += 4) {
    const r = pixel[i];
    const g = pixel[i + 1];
    const b = pixel[i + 2];
    if (!istBrauchbar(r, g, b, pixel[i + 3])) continue;
    const schluessel = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const feld = felder.get(schluessel) ?? { n: 0, r: 0, g: 0, b: 0 };
    feld.n += 1;
    feld.r += r;
    feld.g += g;
    feld.b += b;
    felder.set(schluessel, feld);
  }
  if (felder.size === 0) return null;
  let bestes = null;
  for (const feld of felder.values()) {
    if (!bestes || feld.n > bestes.n) bestes = feld;
  }
  return hexVon(bestes.r / bestes.n, bestes.g / bestes.n, bestes.b / bestes.n);
}

function relativeLeuchtkraft(hex) {
  const [r, g, b] = rgbVon(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG-Kontrastverhältnis zweier Farben (1 bis 21).
export function kontrastVerhaeltnis(hexA, hexB) {
  const a = relativeLeuchtkraft(hexA);
  const b = relativeLeuchtkraft(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Ist weiße Schrift auf dieser Farbe zu schwach lesbar?
export function istZuHell(hex) {
  return kontrastVerhaeltnis(WEISS, hex) < MIN_KONTRAST;
}

// HSL-Umrechnung: Farbton und Sättigung bleiben, nur die Helligkeit sinkt. So wird
// ein helles Gelb zu einem dunkleren Ocker und nicht zu einem grau-oliven Ton.
function hslVonRgb(r, g, b) {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function rgbVonHsl({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Lesbare Akzentfarbe: die Farbe selbst, wenn weiße Schrift darauf reicht. Sonst wird
// die Helligkeit so weit gesenkt, bis es reicht (Farbton und Sättigung bleiben).
export function lesbareAkzentfarbe(hex) {
  if (!istZuHell(hex)) return { farbe: hex, abgedunkelt: false };
  const hsl = hslVonRgb(...rgbVon(hex));
  for (let l = hsl.l; l >= 0; l -= 0.005) {
    const kandidat = hexVon(...rgbVonHsl({ ...hsl, l }));
    if (!istZuHell(kandidat)) return { farbe: kandidat, abgedunkelt: true };
  }
  return { farbe: "#000000", abgedunkelt: true };
}

// Browser: Bild laden, klein zeichnen, Pixel auslesen. Liefert "#rrggbb" oder null.
export function farbeAusBild(src) {
  return new Promise((resolve, reject) => {
    const bild = new Image();
    bild.onload = () => {
      const groesse = 64;
      const faktor = Math.min(1, groesse / Math.max(bild.width, bild.height));
      const breite = Math.max(1, Math.round(bild.width * faktor));
      const hoehe = Math.max(1, Math.round(bild.height * faktor));
      const leinwand = document.createElement("canvas");
      leinwand.width = breite;
      leinwand.height = hoehe;
      const ctx = leinwand.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bild, 0, 0, breite, hoehe);
      resolve(hauptfarbe(ctx.getImageData(0, 0, breite, hoehe).data));
    };
    bild.onerror = () => reject(new Error("Das Logo konnte nicht gelesen werden."));
    bild.src = src;
  });
}
