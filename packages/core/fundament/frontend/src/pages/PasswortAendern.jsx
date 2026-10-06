import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, FormField, Message, Card } from "../components/index.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function PasswortAendern() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  // Erst-Wechsel nach Einladung: der Nutzer hat sich gerade mit dem Startpasswort
  // angemeldet, daher kein altes Passwort abfragen, dafür das neue zweimal.
  const erzwungen = !!user?.mussPasswortAendern;
  const [aktuellesPasswort, setAktuelles] = useState("");
  const [neuesPasswort, setNeues] = useState("");
  const [wiederholung, setWiederholung] = useState("");
  const [fehler, setFehler] = useState(null);
  const [speichert, setSpeichert] = useState(false);

  async function absenden(e) {
    e.preventDefault();
    setFehler(null);
    if (erzwungen && neuesPasswort !== wiederholung) {
      setFehler("Die beiden neuen Passwörter stimmen nicht überein.");
      return;
    }
    setSpeichert(true);
    try {
      const res = await fetch("/api/auth/passwort-aendern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(erzwungen ? { neuesPasswort } : { aktuellesPasswort, neuesPasswort }),
      });
      const daten = await res.json();
      if (!res.ok) throw new Error(daten.error || "Passwort konnte nicht geändert werden.");
      await refresh();
      navigate("/");
    } catch (err) {
      setFehler(err.message);
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <Card>
          <div className="login-brand">
            <div className="login-brand-name">Passwort ändern</div>
          </div>
          <p>Bitte zuerst ein eigenes Passwort vergeben (mindestens 12 Zeichen).</p>
          <form onSubmit={absenden}>
            {fehler && <Message type="fehler">{fehler}</Message>}
            {!erzwungen && (
              <FormField label="Aktuelles Passwort" htmlFor="pw-aktuell">
                <Input
                  id="pw-aktuell"
                  type="password"
                  value={aktuellesPasswort}
                  onChange={(e) => setAktuelles(e.target.value)}
                  required
                />
              </FormField>
            )}
            <FormField label="Neues Passwort" htmlFor="pw-neu">
              <Input
                id="pw-neu"
                type="password"
                value={neuesPasswort}
                onChange={(e) => setNeues(e.target.value)}
                required
              />
            </FormField>
            {erzwungen && (
              <FormField label="Neues Passwort wiederholen" htmlFor="pw-wiederholung">
                <Input
                  id="pw-wiederholung"
                  type="password"
                  value={wiederholung}
                  onChange={(e) => setWiederholung(e.target.value)}
                  required
                />
              </FormField>
            )}
            <Button variant="primary" type="submit" loading={speichert} className="btn-full">
              Passwort ändern
            </Button>
          </form>
          {/* Ausweg, falls der Wechsel scheitert: sonst gibt es keinen Weg zurück */}
          <Button variant="secondary" type="button" onClick={logout} className="btn-full">
            Abmelden
          </Button>
        </Card>
      </div>
    </div>
  );
}
