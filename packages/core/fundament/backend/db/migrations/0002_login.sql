-- Login (Anhang A.4). E-Mail ist installationsweit eindeutig (Björn-Entscheidung),
-- nicht nur pro Firma -- ersetzt den Index aus 0001.
DROP INDEX users_firma_email_unique;
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- Vor dem Login ist noch keine Firma bekannt, RLS kann also noch nicht greifen
-- (app.current_firma_id ist noch nicht gesetzt). Damit die Sitzung trotzdem
-- sofort weiß, zu welcher Firma sie gehört, wird firma_id hier gespeichert.
ALTER TABLE sessions ADD COLUMN firma_id INT NOT NULL REFERENCES firmen(id);
CREATE INDEX sessions_user_id ON sessions (user_id);

-- Login-Versuche: Grundlage für die Sperre nach 5 Fehlversuchen (in der
-- Datenbank, überlebt einen Neustart) und gleichzeitig das Protokoll für
-- Login/Fehlversuch aus Anhang A.4.
CREATE TABLE login_versuche (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  erfolgreich BOOLEAN NOT NULL,
  zeitpunkt TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_adresse INET
);
CREATE INDEX login_versuche_email_zeitpunkt ON login_versuche (lower(email), zeitpunkt DESC);

-- Einzige erlaubte Ausnahme von der Mandanten-Trennung: Beim Login ist die
-- Firma noch nicht bekannt, daher muss der Benutzer anhand der E-Mail über
-- alle Firmen hinweg gefunden werden können. Diese Funktion gibt nur die für
-- den Login nötigen Felder zurück (kein voller Tabellenzugriff für "app").
CREATE FUNCTION login_lookup(p_email TEXT)
RETURNS TABLE (id INT, firma_id INT, passwort_hash TEXT, aktiv BOOLEAN, rolle TEXT, name TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, firma_id, passwort_hash, aktiv, rolle, name
  FROM users
  WHERE lower(email) = lower(p_email)
$$;

REVOKE ALL ON FUNCTION login_lookup(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION login_lookup(TEXT) TO app;
