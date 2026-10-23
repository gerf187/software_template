// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { UebersichtTab } from "../Akte.jsx";
import { rendern, abraeumen } from "@fundament/frontend/src/__vitest__/rendern.jsx";

afterEach(abraeumen);

const PROJEKT = {
  name: "Müller – Typ A",
  arten: ["Typ A"],
  phase: "Start",
  status: "Aktiv",
  auftragsdatum: null,
  ablageLink: null,
};

function zeile(c, label) {
  return [...c.querySelectorAll("p")].find((p) => p.textContent.startsWith(`${label}:`));
}

describe("Projekt-Akte, Tab Übersicht (Fehler A3)", () => {
  it("zeigt Auftragsdatum und Ablage-Link als „–“, wenn leer", async () => {
    const c = await rendern(<UebersichtTab projekt={PROJEKT} />);
    expect(zeile(c, "Auftragsdatum")?.textContent).toBe("Auftragsdatum: –");
    expect(zeile(c, "Ablage-Link")?.textContent).toBe("Ablage-Link: –");
  });

  it("zeigt Auftragsdatum und einen anklickbaren Ablage-Link", async () => {
    const c = await rendern(
      <UebersichtTab
        projekt={{ ...PROJEKT, auftragsdatum: "2026-10-01", ablageLink: "https://ablage.beispiel.test/ordner" }}
      />
    );
    expect(zeile(c, "Auftragsdatum")?.textContent).toBe("Auftragsdatum: 1.10.2026");
    const link = zeile(c, "Ablage-Link")?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://ablage.beispiel.test/ordner");
    expect(link?.getAttribute("target")).toBe("_blank");
  });
});
