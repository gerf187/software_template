-- Superadmin ist plattformweit (Abschnitt 7), keine Firma. Per Regel
-- erzwungen: Superadmin hat immer firma_id = NULL, jede andere Rolle
-- immer eine Firma. Dadurch liefert die Mandanten-Trennung dem Superadmin
-- nie Fachdaten -- er hat schlicht keine Firma, über die RLS greifen könnte.
ALTER TABLE users ALTER COLUMN firma_id DROP NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_superadmin_ohne_firma
  CHECK ((rolle = 'Superadmin') = (firma_id IS NULL));

-- Sitzungen von Superadmin haben ebenfalls keine Firma.
ALTER TABLE sessions ALTER COLUMN firma_id DROP NOT NULL;

-- Der zusammengesetzte Fremdschlüssel (firma_id, user_id) prüft bei NULL
-- nichts (Postgres-Regel bei zusammengesetzten Schlüsseln) -- zusätzlich
-- der einfache Fremdschlüssel, damit user_id auch bei Superadmin-Sitzungen
-- (ohne Firma) geprüft wird.
ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id);

-- Eng begrenzter Lesezugriff für die Sitzungsprüfung eines Superadmin, der
-- -- anders als normale Nutzer -- keine Firma hat, über die RLS greifen
-- könnte (gleiches Muster wie login_lookup).
CREATE FUNCTION superadmin_lookup(p_user_id INT)
RETURNS TABLE (id INT, name TEXT, rolle TEXT, aktiv BOOLEAN)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, rolle, aktiv FROM users
  WHERE id = p_user_id AND firma_id IS NULL AND rolle = 'Superadmin'
$$;

REVOKE ALL ON FUNCTION superadmin_lookup(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION superadmin_lookup(INT) TO app;
