import { lazy, Suspense, useMemo } from "react";
import Spinner from "../components/Spinner.jsx";

// Rendert die Seite eines Bausteins per Lazy-Loading -- "lader" kommt direkt
// aus import.meta.glob() in registry.js (gleiche Form wie React.lazy() erwartet).
export default function ModulSeite({ lader }) {
  const Komponente = useMemo(() => lazy(lader), [lader]);
  return (
    <Suspense fallback={<Spinner label="Baustein wird geladen …" />}>
      <Komponente />
    </Suspense>
  );
}
