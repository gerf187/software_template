import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladePng } from "./png.js";
import { hauptfarbe, kontrastVerhaeltnis, lesbareAkzentfarbe, istZuHell } from "../logoFarbe.js";

// Farbe aus dem Logo ermitteln und prüfen, ob weiße Schrift darauf lesbar ist
// (WCAG: mindestens 4,5 zu 1). Beispielbilder liegen im Ordner beispiele/.

const beispiel = (name) => ladePng(path.join(path.dirname(fileURLToPath(import.meta.url)), "beispiele", name));

// Abstand zweier Farben (größter Kanal-Unterschied)
function abstand(hexA, hexB) {
  const teile = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = teile(hexA);
  const b = teile(hexB);
  return Math.max(...a.map((v, i) => Math.abs(v - b[i])));
}

test("Hauptfarbe: grünes Logo auf weißem Grund ergibt das Grün", () => {
  const farbe = hauptfarbe(beispiel("logo-gruen.png"));
  assert.ok(farbe, "Farbe erwartet");
  assert.ok(abstand(farbe, "#2f7d5c") <= 6, `Abweichung zu groß: ${farbe}`);
});

test("Hauptfarbe: transparenter Hintergrund wird ignoriert, Blau bleibt", () => {
  const farbe = hauptfarbe(beispiel("logo-transparent.png"));
  assert.ok(farbe, "Farbe erwartet");
  assert.ok(abstand(farbe, "#1f5fa8") <= 6, `Abweichung zu groß: ${farbe}`);
});

test("Hauptfarbe: reine Grautöne ergeben keinen Vorschlag", () => {
  assert.equal(hauptfarbe(beispiel("logo-grau.png")), null);
});

test("Kontrast: Schwarz auf Weiß ist 21:1, Grün auf Weiß ausreichend", () => {
  assert.equal(Math.round(kontrastVerhaeltnis("#000000", "#ffffff")), 21);
  assert.ok(kontrastVerhaeltnis("#ffffff", "#2f7d5c") >= 4.5);
});

test("Lesbarkeit: Grün bleibt unverändert, zu helles Gelb wird abgedunkelt", () => {
  const gruen = lesbareAkzentfarbe("#2f7d5c");
  assert.equal(gruen.abgedunkelt, false);
  assert.equal(gruen.farbe, "#2f7d5c");

  const hell = lesbareAkzentfarbe("#f5e08a");
  assert.equal(hell.abgedunkelt, true);
  assert.ok(kontrastVerhaeltnis("#ffffff", hell.farbe) >= 4.5, `Kontrast zu niedrig: ${hell.farbe}`);
});

test("Warnung für manuelle Wahl: helles Gelb gilt als zu hell, Grün nicht", () => {
  assert.equal(istZuHell("#f5e08a"), true);
  assert.equal(istZuHell("#2f7d5c"), false);
});

// HSL-Werte (Farbton in Grad, Sättigung 0..1) aus einem Hex-Wert
function hslVon(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

test("Abdunkeln behält den Farbton und die Sättigung (kein grau-oliv)", () => {
  const original = hslVon("#f5e08a");
  const dunkel = hslVon(lesbareAkzentfarbe("#f5e08a").farbe);
  assert.ok(Math.abs(dunkel.h - original.h) <= 3, `Farbton verschoben: ${dunkel.h} statt ${original.h}`);
  assert.ok(dunkel.s >= original.s - 0.05, `Sättigung verloren: ${dunkel.s}`);
  assert.ok(dunkel.l < original.l, "muss dunkler sein");
});
