-- Startpasswort beim Einladen eines Firmen-Admins muss beim ersten Login
-- geändert werden (Abschnitt 8, Anhang A.4).
ALTER TABLE users ADD COLUMN muss_passwort_aendern BOOLEAN NOT NULL DEFAULT false;

-- Gesperrte Firmen (Abschnitt 7: Superadmin kann Firmen sperren) dürfen sich
-- nicht mehr anmelden. Vor dem Login ist noch keine Firma bekannt (gleiche
-- Begründung wie login_lookup selbst in 0002), darum hier mit ausliefern.
DROP FUNCTION login_lookup(TEXT);
CREATE FUNCTION login_lookup(p_email TEXT)
RETURNS TABLE (
  id INT, firma_id INT, passwort_hash TEXT, aktiv BOOLEAN, rolle TEXT, name TEXT,
  firma_aktiv BOOLEAN, muss_passwort_aendern BOOLEAN
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.firma_id, u.passwort_hash, u.aktiv, u.rolle, u.name,
         COALESCE(f.aktiv, true) AS firma_aktiv, u.muss_passwort_aendern
  FROM users u
  LEFT JOIN firmen f ON f.id = u.firma_id
  WHERE lower(u.email) = lower(p_email)
$$;

REVOKE ALL ON FUNCTION login_lookup(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION login_lookup(TEXT) TO app;
