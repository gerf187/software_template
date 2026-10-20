// Leere Ränder eines hochgeladenen Logos automatisch abschneiden (Abschnitt 9,
// Punkt 0.2): transparente und nahezu weiße Pixel am Rand gelten als leer.
// berechneZuschnitt ist rein (ohne Browser) und wird getestet. schneideLogoZu
// zeichnet im Browser über Canvas, wie farbeAusBild in logoFarbe.js.

const WEISS_SCHWELLE = 250; // ab diesem Wert je Kanal gilt ein Pixel als "fast weiß"
const ALPHA_SCHWELLE = 10; // unter diesem Alpha-Wert gilt ein Pixel als transparent

function istLeeresPixel(r, g, b, a) {
  if (a < ALPHA_SCHWELLE) return true;
  return r >= WEISS_SCHWELLE && g >= WEISS_SCHWELLE && b >= WEISS_SCHWELLE;
}

// Kleinstes Rechteck, das alle nicht-leeren Pixel enthält (rechts/unten exklusiv).
// Ist das Bild komplett leer, gibt es nichts zuzuschneiden: null.
export function berechneZuschnitt(pixel, breite, hoehe) {
  let left = breite;
  let right = -1;
  let top = hoehe;
  let bottom = -1;
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const i = (y * breite + x) * 4;
      if (istLeeresPixel(pixel[i], pixel[i + 1], pixel[i + 2], pixel[i + 3])) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null;
  return { left, top, right: right + 1, bottom: bottom + 1 };
}

// Browser: Bild laden, Ränder berechnen, auf den Ausschnitt neu zeichnen. Ist
// das Bild schon randlos (oder komplett leer), bleibt die Quelle unverändert.
export function schneideLogoZu(src) {
  return new Promise((resolve, reject) => {
    const bild = new Image();
    bild.onload = () => {
      const breite = bild.width;
      const hoehe = bild.height;
      const quelle = document.createElement("canvas");
      quelle.width = breite;
      quelle.height = hoehe;
      const quellKontext = quelle.getContext("2d", { willReadFrequently: true });
      quellKontext.drawImage(bild, 0, 0);

      const zuschnitt = berechneZuschnitt(
        quellKontext.getImageData(0, 0, breite, hoehe).data,
        breite,
        hoehe
      );
      if (!zuschnitt) {
        resolve(src);
        return;
      }
      const zBreite = zuschnitt.right - zuschnitt.left;
      const zHoehe = zuschnitt.bottom - zuschnitt.top;
      if (zuschnitt.left === 0 && zuschnitt.top === 0 && zBreite === breite && zHoehe === hoehe) {
        resolve(src);
        return;
      }

      const ziel = document.createElement("canvas");
      ziel.width = zBreite;
      ziel.height = zHoehe;
      ziel
        .getContext("2d")
        .drawImage(quelle, zuschnitt.left, zuschnitt.top, zBreite, zHoehe, 0, 0, zBreite, zHoehe);
      resolve(ziel.toDataURL("image/png"));
    };
    bild.onerror = () => reject(new Error("Das Logo konnte nicht gelesen werden."));
    bild.src = src;
  });
}
