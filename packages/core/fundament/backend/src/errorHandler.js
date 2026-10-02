// Letzte Sicherung für nicht abgefangene Fehler (Phase 3): einheitliches
// JSON statt Express' Standard-Fehlerseite, im Produktivbetrieb ohne
// technische Details (kein Stacktrace, keine Fehlermeldung aus der
// Datenbank) -- die steht nur im Server-Log.
export function fehlerBehandlung(err, req, res, next) {
  if (res.headersSent) return next(err);
  console.error(err);

  const produktion = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: "Es ist ein Fehler aufgetreten.",
    ...(produktion ? {} : { details: err.message }),
  });
}
