import { describe, it, expect } from "vitest";
import { modulConfig, modulSeitenLader, modulAkteLader, erweiterungsKomponente } from "../registry.js";
import { kachelKomponente } from "../../dashboard/kachelRegistry.js";

// Läuft über Vitest (nicht node --test), weil import.meta.glob nur unter
// Vites echter Bundler-Transformation funktioniert. Prüft genau die Lücke,
// die bisher nie automatisch getestet wurde: ein Baustein aus
// packages/modules (gemeinsam, hier "projekte") muss im Frontend genauso
// gefunden werden wie einer aus apps/<app>/modules (hier "beispiel") --
// Abschnitt 5/8 der CLAUDE.md.

describe("Baustein aus packages/modules (\"projekte\")", () => {
  it("modulConfig liefert die Konfiguration", () => {
    const config = modulConfig("projekte");
    expect(config).toBeTruthy();
    expect(config.titel).toBe("Projekte");
  });

  it("modulSeitenLader liefert einen Lader für die Seite", () => {
    expect(modulSeitenLader("projekte")).toBeTruthy();
  });

  it("modulAkteLader liefert einen Lader für die Projekt-Akte", () => {
    expect(modulAkteLader("projekte")).toBeTruthy();
  });

  it("erweiterungsKomponente liefert den Kontakt-Tab \"projekte\"", () => {
    expect(erweiterungsKomponente("kontaktTabs", "projekte", "projekte")).toBeTruthy();
  });

  it("kachelKomponente liefert die Kachel \"nachPhase\"", () => {
    expect(kachelKomponente("projekte:nachPhase")).toBeTruthy();
  });
});

describe("Baustein aus apps/<app>/modules (\"beispiel\") bleibt funktionsfähig", () => {
  it("modulConfig liefert die Konfiguration", () => {
    const config = modulConfig("beispiel");
    expect(config).toBeTruthy();
    expect(config.titel).toBe("Beispiel");
  });

  it("modulSeitenLader liefert einen Lader für die Seite", () => {
    expect(modulSeitenLader("beispiel")).toBeTruthy();
  });

  it("kachelKomponente liefert die Kachel \"beispiel\"", () => {
    expect(kachelKomponente("beispiel:beispiel")).toBeTruthy();
  });
});
