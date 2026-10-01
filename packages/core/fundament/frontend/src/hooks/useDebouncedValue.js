import { useEffect, useState } from "react";

// Abschnitt 9: Suchfelder laden automatisch, mit 250 ms Verzögerung, statt
// einen eigenen Such-Button zu brauchen.
export default function useDebouncedValue(wert, verzoegerungMs = 250) {
  const [verzoegert, setVerzoegert] = useState(wert);

  useEffect(() => {
    const timer = setTimeout(() => setVerzoegert(wert), verzoegerungMs);
    return () => clearTimeout(timer);
  }, [wert, verzoegerungMs]);

  return verzoegert;
}
