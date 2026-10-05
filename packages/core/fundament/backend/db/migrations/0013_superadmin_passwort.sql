-- Superadmin darf sein Passwort ändern. Er hat keine Firma (firma_id IS NULL),
-- darum sieht die Mandanten-Trennung seine Zeile nicht. Gleiches Muster wie
-- superadmin_lookup (0007): zwei eng begrenzte Funktionen, die nur Superadmin-
-- Zeilen anfassen -- nicht die ganze Tabelle für die App-Rolle öffnen.

CREATE FUNCTION superadmin_passwort_lesen(p_user_id INT)
RETURNS TABLE (email TEXT, passwort_hash TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT email, passwort_hash FROM users
  WHERE id = p_user_id AND firma_id IS NULL AND rolle = 'Superadmin'
$$;

CREATE FUNCTION superadmin_passwort_setzen(p_user_id INT, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH geaendert AS (
    UPDATE users SET passwort_hash = p_hash, muss_passwort_aendern = false
    WHERE id = p_user_id AND firma_id IS NULL AND rolle = 'Superadmin'
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM geaendert)
$$;

REVOKE ALL ON FUNCTION superadmin_passwort_lesen(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION superadmin_passwort_setzen(INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION superadmin_passwort_lesen(INT) TO app;
GRANT EXECUTE ON FUNCTION superadmin_passwort_setzen(INT, TEXT) TO app;
