// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import ProjektFormular from "../ProjektFormular.jsx";
import { rendern, abraeumen, tippe, klicke, abschicken } from "@fundament/frontend/src/__vitest__/rendern.jsx";

afterEach(abraeumen);

const KONTAKT = { id: 1, nachname: "Müller" };

async function formular() {
  const onSpeichern = vi.fn().mockResolvedValue(undefined);
  const c = await rendern(<ProjektFormular kontakt={KONTAKT} onSpeichern={onSpeichern} onAbbrechen={() => {}} />);
  return { c, onSpeichern };
}

async function artAnhaken(c) {
  await klicke(c.querySelector(".checkbox input"));
}

describe("ProjektFormular: Projektart ist Pflicht (Fehler A2)", () => {
  it("speichert nicht ohne Projektart und zeigt eine Meldung", async () => {
    const { c, onSpeichern } = await formular();
    await abschicken(c.querySelector("form"));
    expect(onSpeichern).not.toHaveBeenCalled();
    expect(c.textContent).toContain("Bitte mindestens eine Projektart auswählen.");
  });

  it("speichert mit einer Projektart", async () => {
    const { c, onSpeichern } = await formular();
    await artAnhaken(c);
    await abschicken(c.querySelector("form"));
    expect(onSpeichern).toHaveBeenCalled();
  });
});

describe("ProjektFormular: PLZ (Fehler A4)", () => {
  it("lehnt eine PLZ mit weniger als 5 Ziffern ab", async () => {
    const { c, onSpeichern } = await formular();
    await artAnhaken(c);
    await tippe(c.querySelector("#pf-plz"), "1234");
    await abschicken(c.querySelector("form"));
    expect(onSpeichern).not.toHaveBeenCalled();
    expect(c.textContent).toContain("Die PLZ muss aus genau 5 Ziffern bestehen.");
  });

  it("speichert mit gültiger PLZ", async () => {
    const { c, onSpeichern } = await formular();
    await artAnhaken(c);
    await tippe(c.querySelector("#pf-plz"), "26122");
    await abschicken(c.querySelector("form"));
    expect(onSpeichern).toHaveBeenCalled();
  });
});
