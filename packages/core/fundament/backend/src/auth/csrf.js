// Schutz gegen Anfragen von fremden Webseiten (CSRF, Phase 3). Das Login
// läuft über ein Cookie (sameSite: lax, Anhang A.4) -- das verhindert schon
// die meisten Fälle, aber nicht unbedingt ein einfaches <form>-Formular von
// einer fremden Seite. Zusätzliche Prüfung ohne eigenes Token-System: der
// Browser schickt bei eigenen Anfragen "Sec-Fetch-Site: same-origin" mit,
// das lässt sich von einer fremden Seite aus nicht fälschen. Ältere Browser
// ohne dieses Headerfeld: Origin gegen den aufgerufenen Host prüfen.
const SICHERE_METHODEN = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfSchutz(req, res, next) {
  if (SICHERE_METHODEN.has(req.method)) return next();

  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchSite) {
    if (secFetchSite === "same-origin" || secFetchSite === "none") return next();
    return res.status(403).json({ error: "Anfrage von einer fremden Seite abgelehnt." });
  }

  const origin = req.headers.origin;
  if (origin) {
    const erwartet = `${req.protocol}://${req.headers.host}`;
    if (origin !== erwartet) {
      return res.status(403).json({ error: "Anfrage von einer fremden Seite abgelehnt." });
    }
  }

  // Weder Sec-Fetch-Site noch Origin gesetzt (z. B. ältere Clients, direkte
  // API-Nutzung ohne Browser): nicht blockieren, dafür gibt es die normale
  // Rechte-/Login-Prüfung.
  next();
}
