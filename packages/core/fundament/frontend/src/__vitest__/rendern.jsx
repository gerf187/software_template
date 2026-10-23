// Hilfen für Vitest-Tests mit echtem React-Rendering in jsdom (Test-Datei
// braucht dafür oben "// @vitest-environment jsdom"). Keine Test-Datei
// selbst (Name endet nicht auf .test.jsx).
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let offen = [];

export async function rendern(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter>{element}</MemoryRouter>);
  });
  offen.push({ root, container });
  return container;
}

export function abraeumen() {
  for (const { root, container } of offen) {
    act(() => root.unmount());
    container.remove();
  }
  offen = [];
}

// Wert in ein Eingabefeld schreiben, so dass Reacts onChange auslöst.
export async function tippe(feld, wert) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    setter.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export async function klicke(element) {
  await act(async () => {
    element.click();
  });
}

// Formular abschicken ohne die Browser-Pflichtfeldprüfung (required) --
// getestet wird die eigene Prüfung des Formulars.
export async function abschicken(form) {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
