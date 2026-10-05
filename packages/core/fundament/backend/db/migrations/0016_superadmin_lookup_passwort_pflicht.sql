-- superadmin_lookup liefert auch das Flag "Startpasswort muss geändert werden"
-- (muss_passwort_aendern). Ohne das Flag war die Pflicht für den Superadmin
-- im Backend nicht wirksam. Rückgabetyp ändert sich, darum neu anlegen.

DROP FUNCTION superadmin_lookup(INT);

CREATE FUNCTION superadmin_lookup(p_user_id INT)
RETURNS TABLE (id INT, name TEXT, rolle TEXT, aktiv BOOLEAN, muss_passwort_aendern BOOLEAN)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, rolle, aktiv, muss_passwort_aendern FROM users
  WHERE id = p_user_id AND firma_id IS NULL AND rolle = 'Superadmin'
$$;

REVOKE ALL ON FUNCTION superadmin_lookup(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION superadmin_lookup(INT) TO app;
