// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { Routes, Route } from "react-router-dom";
import { rendern, abraeumen } from "@fundament/frontend/src/__vitest__/rendern.jsx";

// C3: Rolle User darf Projekte nicht löschen (modul.config.js: loeschen: false).
// Backend-Seite (403) prüft backend/__tests__/routes.test.js, hier die
// Oberfläche: der Button "Löschen" erscheint gar nicht erst.

let rechte;
vi.mock("@fundament/frontend/src/auth/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { module: ["projekte"], rechte } }),
}));
vi.mock("@fundament/frontend/src/kontakte/api.js", () => ({
  holeKontakt: () => Promise.resolve({ id: 1, nachname: "Müller" }),
}));
vi.mock("../api.js", () => ({
  holeProjekt: () =>
    Promise.resolve({ id: 7, contactId: 1, name: "Müller – Typ A", arten: ["Typ A"], status: "Aktiv", phase: "Start" }),
}));

const { default: ProjektAkte } = await import("../Akte.jsx");

afterEach(abraeumen);

async function akteAls(projektRechte) {
  rechte = { projekte: projektRechte };
  const c = await rendern(
    <Routes>
      <Route path="*" element={<ProjektAkte />} />
    </Routes>
  );
  for (let i = 0; i < 20 && !c.textContent.includes("Müller – Typ A"); i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  return c;
}

function buttonTexte(c) {
  return [...c.querySelectorAll("button")].map((b) => b.textContent.trim());
}

describe("Projekt-Akte: Löschen-Button nach Recht (C3)", () => {
  it("Rolle User (sehen + bearbeiten, nicht löschen): kein Löschen-Button", async () => {
    const c = await akteAls({ sehen: true, bearbeiten: true, loeschen: false });
    expect(c.textContent).toContain("Müller – Typ A");
    expect(buttonTexte(c)).toContain("Bearbeiten");
    expect(buttonTexte(c)).not.toContain("Löschen");
  });

  it("mit Löschrecht (Admin): Löschen-Button sichtbar", async () => {
    const c = await akteAls({ sehen: true, bearbeiten: true, loeschen: true });
    expect(buttonTexte(c)).toContain("Löschen");
  });
});
