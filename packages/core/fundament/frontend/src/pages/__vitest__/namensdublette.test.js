import { describe, it, expect } from "vitest";
import { findeNamensdublette } from "../SuperadminFirmen.jsx";

// Teil A, Punkt 3: gleiche Firmennamen bleiben erlaubt, es gibt nur einen
// Warnhinweis. Groß-/Kleinschreibung und Leerzeichen am Anfang/Ende spielen
// beim Vergleich keine Rolle (Björns Vorgabe).
const FIRMEN = [
  { id: 1, name: "Demo Firma A", kundennummer: "K-0001", ort: "Köln" },
  { id: 2, name: "Demo Firma B", kundennummer: "K-0002", ort: "Bonn" },
];

describe("findeNamensdublette (Teil A, Punkt 3)", () => {
  it("findet eine Dublette bei exakt gleichem Namen", () => {
    expect(findeNamensdublette("Demo Firma A", FIRMEN, null)?.id).toBe(1);
  });

  it("ignoriert Groß-/Kleinschreibung", () => {
    expect(findeNamensdublette("DEMO firma a", FIRMEN, null)?.id).toBe(1);
  });

  it("ignoriert Leerzeichen am Anfang/Ende", () => {
    expect(findeNamensdublette("  Demo Firma A  ", FIRMEN, null)?.id).toBe(1);
  });

  it("findet beim Bearbeiten keine Dublette mit sich selbst", () => {
    expect(findeNamensdublette("Demo Firma A", FIRMEN, 1)).toBe(null);
  });

  it("liefert null ohne passenden Namen", () => {
    expect(findeNamensdublette("Ganz andere Firma", FIRMEN, null)).toBe(null);
  });

  it("liefert null bei leerem Namen (noch nichts eingetippt)", () => {
    expect(findeNamensdublette("", FIRMEN, null)).toBe(null);
  });
});
