import { useState } from "react";
import Button from "./Button.jsx";

// Zugangsdaten nach einer Einladung: E-Mail und Startpasswort zusammen, mit Knopf
// zum Kopieren. Das Startpasswort wird nur einmal angezeigt.
export default function Zugangsdaten({ email, startpasswort, onAusblenden }) {
  const [kopiert, setKopiert] = useState(null); // null | "ok" | "fehler"
  const text = `E-Mail: ${email}\nStartpasswort: ${startpasswort}`;

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(text);
      setKopiert("ok");
    } catch {
      setKopiert("fehler");
    }
  }

  const knopfText =
    kopiert === "ok"
      ? "Kopiert"
      : kopiert === "fehler"
        ? "Kopieren nicht möglich, bitte markieren"
        : "Zugangsdaten kopieren";

  return (
    <div className="message message-erfolg zugangsdaten">
      <div>Zugangsdaten für {email}. Wird nur jetzt angezeigt, bitte sicher übermitteln.</div>
      <pre>{text}</pre>
      <div className="zugangsdaten-aktionen">
        <Button variant="secondary" onClick={kopieren}>
          {knopfText}
        </Button>
        <Button variant="text" onClick={onAusblenden}>
          Ausblenden
        </Button>
      </div>
    </div>
  );
}
