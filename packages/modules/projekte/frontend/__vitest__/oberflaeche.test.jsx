// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import ProjektStatusBadge from "../ProjektStatusBadge.jsx";
import ProjektFormular from "../ProjektFormular.jsx";
import { rendern, abraeumen, tippe, klicke, abschicken } from "@fundament/frontend/src/__vitest__/rendern.jsx";

afterEach(abraeumen);

describe("ProjektStatusBadge (B2)", () => {
  // Status-Liste aus apps/werkstatt/app.config.js (Vitest läuft mit der Werkstatt).
  it.each([
    ["Aktiv", "badge-success"],
    ["Pausiert (manuell)", "badge-warn"],
    ["Pausiert (Eskalation)", "badge-warn"],
    ["Abgeschlossen", "badge-neutral"],
    ["Storniert", "badge-neutral"],
    ["Unbekannt", "badge-neutral"],
  ])("%s → %s", async (status, klasse) => {
    const c = await rendern(<ProjektStatusBadge status={status} />);
    expect(c.querySelector(".badge").classList.contains(klasse)).toBe(true);
  });
});

describe("Projektname (B1)", () => {
  const KONTAKT = { id: 1, nachname: "Müller" };

  it("zeigt leer den Platzhalter „wird automatisch erzeugt“", async () => {
    const c = await rendern(<ProjektFormular kontakt={KONTAKT} onSpeichern={() => {}} onAbbrechen={() => {}} />);
    const feld = c.querySelector("#pf-name");
    expect(feld.value).toBe("");
    expect(feld.getAttribute("placeholder")).toBe("wird automatisch erzeugt");
  });

  it("erzeugt den Namen beim Speichern, wenn das Feld geleert wurde", async () => {
    const onSpeichern = vi.fn().mockResolvedValue(undefined);
    const c = await rendern(<ProjektFormular kontakt={KONTAKT} onSpeichern={onSpeichern} onAbbrechen={() => {}} />);
    await klicke(c.querySelector(".checkbox input"));
    await tippe(c.querySelector("#pf-name"), "");
    await abschicken(c.querySelector("form"));
    expect(onSpeichern).toHaveBeenCalledWith(expect.objectContaining({ name: "Müller – Typ A" }));
  });

  it("schaltet nach dem Leeren den automatischen Vorschlag wieder ein", async () => {
    const c = await rendern(<ProjektFormular kontakt={KONTAKT} onSpeichern={() => {}} onAbbrechen={() => {}} />);
    const feld = c.querySelector("#pf-name");
    await tippe(feld, "Eigener Name");
    await tippe(feld, "");
    await klicke(c.querySelector(".checkbox input"));
    expect(feld.value).toBe("Müller – Typ A");
  });
});
