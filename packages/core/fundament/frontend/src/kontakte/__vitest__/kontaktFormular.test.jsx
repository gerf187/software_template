// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import KontaktFormular from "../KontaktFormular.jsx";
import { rendern, abraeumen, tippe, abschicken } from "../../__vitest__/rendern.jsx";

afterEach(abraeumen);

async function formularMit({ nachname = "Müller", plz }) {
  const onSpeichern = vi.fn().mockResolvedValue(undefined);
  const c = await rendern(<KontaktFormular onSpeichern={onSpeichern} onAbbrechen={() => {}} />);
  await tippe(c.querySelector("#kf-nachname"), nachname);
  if (plz !== undefined) await tippe(c.querySelector("#kf-plz"), plz);
  await abschicken(c.querySelector("form"));
  return { c, onSpeichern };
}

describe("KontaktFormular: PLZ (Fehler A4)", () => {
  it("lehnt eine PLZ mit weniger als 5 Ziffern ab", async () => {
    const { c, onSpeichern } = await formularMit({ plz: "1234" });
    expect(onSpeichern).not.toHaveBeenCalled();
    expect(c.textContent).toContain("Die PLZ muss aus genau 5 Ziffern bestehen.");
  });

  it("lehnt Buchstaben in der PLZ ab", async () => {
    const { onSpeichern } = await formularMit({ plz: "12a45" });
    expect(onSpeichern).not.toHaveBeenCalled();
  });

  it("speichert mit gültiger oder leerer PLZ", async () => {
    expect((await formularMit({ plz: "26122" })).onSpeichern).toHaveBeenCalled();
    expect((await formularMit({ plz: "" })).onSpeichern).toHaveBeenCalled();
  });
});
