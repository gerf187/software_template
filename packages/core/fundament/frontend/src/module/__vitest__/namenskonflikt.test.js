import { describe, it, expect } from "vitest";
import { pruefeKonflikte } from "../registry.js";

// C1: Namenskonflikt-Prüfung in registry.js (gleiche Regel wie module/lade.js
// im Backend): derselbe Baustein-Name in apps/<app>/modules und in
// packages/modules bricht hart ab.

const APP = "../../../../../../apps/werkstatt/modules/projekte/modul.config.js";
const ANDERE_APP = "../../../../../../apps/energieberater/modules/projekte/modul.config.js";
const GEMEINSAM = "../../../../../modules/projekte/modul.config.js";
const ANDERER = "../../../../../modules/anderer/modul.config.js";

describe("Namenskonflikt-Prüfung (C1)", () => {
  it("bricht ab, wenn ein Baustein in der App und in packages/modules liegt", () => {
    expect(() => pruefeKonflikte([APP, GEMEINSAM], "werkstatt")).toThrow(/Namenskonflikt: Baustein "projekte"/);
  });

  it("kein Konflikt, wenn der gleiche Name nur in einer anderen App liegt", () => {
    expect(() => pruefeKonflikte([ANDERE_APP, GEMEINSAM], "werkstatt")).not.toThrow();
  });

  it("kein Konflikt bei unterschiedlichen Namen", () => {
    expect(() => pruefeKonflikte([APP, ANDERER], "werkstatt")).not.toThrow();
  });

  it("die echten Bausteine der Werkstatt haben keinen Konflikt (Import klappt)", async () => {
    await expect(import("../registry.js")).resolves.toBeTruthy();
  });
});
