// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import ModulSeite from "../ModulSeite.jsx";

// Fehler A1 (Klicktest): Klick in der Projektliste änderte nur die URL, die
// Akte erschien nie. Liste und Akte sind beide ModulSeite an derselben Stelle
// im Routen-Baum -- React Router 7 navigiert per startTransition, und eine
// bei jedem Versuch neu gebaute lazy()-Komponente wurde dabei nie fertig.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Liste() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/projekte/7")}>Zeile 7</button>;
}

function Akte() {
  return <h1>Akte 7</h1>;
}

const listeLader = () => Promise.resolve({ default: Liste });
const akteLader = () => Promise.resolve({ default: Akte });

let container;
let root;

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function warteAuf(pruefung) {
  for (let i = 0; i < 50; i++) {
    if (pruefung()) return true;
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
  return pruefung();
}

describe("ModulSeite", () => {
  it("wechselt von der Liste zur Akte desselben Bausteins", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/projekte"]}>
          <Routes>
            <Route path="/projekte" element={<ModulSeite lader={listeLader} />} />
            <Route path="/projekte/:id" element={<ModulSeite lader={akteLader} />} />
          </Routes>
        </MemoryRouter>
      );
    });
    expect(await warteAuf(() => container.querySelector("button"))).toBeTruthy();

    await act(async () => {
      container.querySelector("button").click();
    });

    expect(await warteAuf(() => container.textContent.includes("Akte 7"))).toBe(true);
  });
});
