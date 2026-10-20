import { test } from "node:test";
import assert from "node:assert/strict";
import { berechneZuschnitt } from "../logoZuschnitt.js";

// Pixel-Raster aus Zeichen bauen: "." = transparent, "w" = weiß, "x" = Farbe.
// So lassen sich Beispiele lesbar als Text-Raster statt als Bild-Datei schreiben.
function raster(zeilen) {
  const hoehe = zeilen.length;
  const breite = zeilen[0].length;
  const pixel = new Uint8ClampedArray(breite * hoehe * 4);
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const i = (y * breite + x) * 4;
      const zeichen = zeilen[y][x];
      if (zeichen === ".") {
        pixel[i + 3] = 0; // transparent
      } else if (zeichen === "w") {
        pixel[i] = pixel[i + 1] = pixel[i + 2] = 255;
        pixel[i + 3] = 255;
      } else {
        pixel[i] = 47;
        pixel[i + 1] = 125;
        pixel[i + 2] = 92;
        pixel[i + 3] = 255;
      }
    }
  }
  return { pixel, breite, hoehe };
}

test("Transparenter Rand wird erkannt und abgeschnitten", () => {
  const { pixel, breite, hoehe } = raster([
    "......",
    "..xx..",
    "..xx..",
    "......",
  ]);
  const zuschnitt = berechneZuschnitt(pixel, breite, hoehe);
  assert.deepEqual(zuschnitt, { left: 2, top: 1, right: 4, bottom: 3 });
});

test("Weißer Rand wird wie ein transparenter Rand behandelt", () => {
  const { pixel, breite, hoehe } = raster([
    "wwwwww",
    "wwxxww",
    "wwxxww",
    "wwwwww",
  ]);
  const zuschnitt = berechneZuschnitt(pixel, breite, hoehe);
  assert.deepEqual(zuschnitt, { left: 2, top: 1, right: 4, bottom: 3 });
});

test("Logo ohne Rand bleibt unverändert (Zuschnitt = ganzes Bild)", () => {
  const { pixel, breite, hoehe } = raster(["xx", "xx"]);
  const zuschnitt = berechneZuschnitt(pixel, breite, hoehe);
  assert.deepEqual(zuschnitt, { left: 0, top: 0, right: 2, bottom: 2 });
});

test("Komplett leeres Bild liefert keinen Zuschnitt (null)", () => {
  const { pixel, breite, hoehe } = raster(["....", "...."]);
  assert.equal(berechneZuschnitt(pixel, breite, hoehe), null);
});

test("Ungleichmäßiger Rand: jede Seite wird einzeln bis zum Inhalt abgeschnitten", () => {
  const { pixel, breite, hoehe } = raster([
    "........",
    "...x....",
    "...xxx..",
    "........",
    "........",
  ]);
  const zuschnitt = berechneZuschnitt(pixel, breite, hoehe);
  assert.deepEqual(zuschnitt, { left: 3, top: 1, right: 6, bottom: 3 });
});
