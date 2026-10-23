import { describe, it, expect } from "vitest";
import { sucheModulKachel, kachelKomponente } from "../kachelRegistry.js";

// C2: wie registry.js zählen nur Kacheln der laufenden App (Vitest: Werkstatt)
// und der gemeinsamen Bausteine aus packages/modules -- nie die einer anderen App.

const FremdeKachel = () => null;
const EigeneKachel = () => null;
const GemeinsameKachel = () => null;

const BEISPIEL_KACHELN = {
  "../../../../../../apps/energieberater/modules/nurEb/frontend/Kacheln.jsx": { default: { k: FremdeKachel } },
  "../../../../../../apps/werkstatt/modules/eigen/frontend/Kacheln.jsx": { default: { k: EigeneKachel } },
  "../../../../../modules/gemeinsam/frontend/Kacheln.jsx": { default: { k: GemeinsameKachel } },
};

describe("Kachel-Registry: nur laufende App + packages/modules (C2)", () => {
  it("findet keine Kachel aus einer anderen App", () => {
    expect(sucheModulKachel(BEISPIEL_KACHELN, "nurEb:k")).toBe(null);
  });

  it("findet Kacheln der laufenden App", () => {
    expect(sucheModulKachel(BEISPIEL_KACHELN, "eigen:k")).toBe(EigeneKachel);
  });

  it("findet Kacheln aus packages/modules", () => {
    expect(sucheModulKachel(BEISPIEL_KACHELN, "gemeinsam:k")).toBe(GemeinsameKachel);
  });

  it("echte Kacheln: projekte (packages/modules) und beispiel (Werkstatt) werden gefunden", () => {
    expect(kachelKomponente("projekte:zuletzt")).toBeTruthy();
    expect(kachelKomponente("beispiel:beispiel")).toBeTruthy();
  });
});
