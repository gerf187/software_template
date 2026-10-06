// Mini-Decoder für Test-Bilder (8 Bit, RGB oder RGBA, ohne Interlace). Gibt RGBA-Pixel
// zurück, so wie der Browser sie über Canvas liefert.
import fs from "node:fs";
import zlib from "node:zlib";

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function ladePng(pfad) {
  const d = fs.readFileSync(pfad);
  let p = 8;
  let breite;
  let hoehe;
  let farbtyp;
  const idat = [];
  while (p < d.length) {
    const len = d.readUInt32BE(p);
    const typ = d.toString("ascii", p + 4, p + 8);
    const daten = d.subarray(p + 8, p + 8 + len);
    if (typ === "IHDR") {
      breite = daten.readUInt32BE(0);
      hoehe = daten.readUInt32BE(4);
      if (daten[8] !== 8) throw new Error("Nur 8-Bit-PNG");
      farbtyp = daten[9];
    }
    if (typ === "IDAT") idat.push(daten);
    p += 12 + len;
  }
  if (farbtyp !== 2 && farbtyp !== 6) throw new Error("Nur RGB oder RGBA");
  const kanaele = farbtyp === 6 ? 4 : 3;
  const roh = zlib.inflateSync(Buffer.concat(idat));
  const zeile = breite * kanaele;
  const bild = Buffer.alloc(zeile * hoehe);
  let vorher = Buffer.alloc(zeile);
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)];
    const scan = roh.subarray(y * (zeile + 1) + 1, (y + 1) * (zeile + 1));
    const aktuell = Buffer.alloc(zeile);
    for (let x = 0; x < zeile; x++) {
      const a = x >= kanaele ? aktuell[x - kanaele] : 0;
      const b = vorher[x];
      const c = x >= kanaele ? vorher[x - kanaele] : 0;
      let v = scan[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      aktuell[x] = v & 255;
    }
    aktuell.copy(bild, y * zeile);
    vorher = aktuell;
  }
  const pixel = new Uint8ClampedArray(breite * hoehe * 4);
  for (let i = 0; i < breite * hoehe; i++) {
    pixel[i * 4] = bild[i * kanaele];
    pixel[i * 4 + 1] = bild[i * kanaele + 1];
    pixel[i * 4 + 2] = bild[i * kanaele + 2];
    pixel[i * 4 + 3] = kanaele === 4 ? bild[i * kanaele + 3] : 255;
  }
  return pixel;
}
