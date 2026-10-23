import { lazy, Suspense } from "react";
import Spinner from "../components/Spinner.jsx";

// Eine lazy()-Komponente pro Lader, einmal gebaut und danach immer dieselbe.
// Nicht per useMemo: React Router 7 navigiert per startTransition, und ein
// Render, der dabei noch wartet, wird verworfen -- useMemo baute beim nächsten
// Versuch wieder eine neue, noch nicht geladene Komponente, die Seite wurde
// nie fertig (Klick Projektliste -> Akte blieb auf der Liste stehen).
const komponenten = new WeakMap();

function lazyKomponente(lader) {
  if (!komponenten.has(lader)) komponenten.set(lader, lazy(lader));
  return komponenten.get(lader);
}

// Rendert die Seite eines Bausteins per Lazy-Loading -- "lader" kommt direkt
// aus import.meta.glob() in registry.js (gleiche Form wie React.lazy() erwartet).
export default function ModulSeite({ lader }) {
  const Komponente = lazyKomponente(lader);
  return (
    <Suspense fallback={<Spinner label="Baustein wird geladen …" />}>
      <Komponente />
    </Suspense>
  );
}
