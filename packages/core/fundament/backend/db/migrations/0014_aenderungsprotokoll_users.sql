-- Änderungsprotokoll für Mitarbeiter (users), mit drei Schutzregeln:
--  1. passwort_hash wird nie ins Protokoll geschrieben (weder alt noch neu).
--  2. Zeilen ohne Firma (Superadmin) werden übersprungen: aenderungsprotokoll.firma_id
--     ist Pflicht und ein Superadmin hat keine Firma.
--  3. aenderungsprotokoll_aktivieren() lehnt Tabellen ohne Spalte "id" ab
--     (z. B. rechte), weil der Trigger die Datensatz-Nummer braucht.

CREATE OR REPLACE FUNCTION aenderungsprotokoll_eintragen() RETURNS trigger AS $$
DECLARE
  v_user_id INT := NULLIF(current_setting('app.current_user_id', true), '')::int;
  v_aktion TEXT;
  v_firma_id INT;
  v_datensatz_id INT;
  v_alte_werte JSONB;
  v_neue_werte JSONB;
  -- Spalten, die nie im Protokoll landen dürfen.
  v_ausgeschlossen TEXT[] := CASE
    WHEN TG_TABLE_NAME = 'users' THEN ARRAY['passwort_hash']
    ELSE ARRAY[]::TEXT[]
  END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_firma_id := OLD.firma_id;
  ELSE
    v_firma_id := NEW.firma_id;
  END IF;

  -- Regel 2: ohne Firma (Superadmin) nichts protokollieren.
  IF v_firma_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_alte_werte := to_jsonb(OLD) - v_ausgeschlossen;
    v_neue_werte := NULL;
    v_datensatz_id := OLD.id;
    v_aktion := 'geloescht';
  ELSIF TG_OP = 'INSERT' THEN
    v_alte_werte := NULL;
    v_neue_werte := to_jsonb(NEW) - v_ausgeschlossen;
    v_datensatz_id := NEW.id;
    v_aktion := 'angelegt';
  ELSE
    v_alte_werte := to_jsonb(OLD) - v_ausgeschlossen;
    v_neue_werte := to_jsonb(NEW) - v_ausgeschlossen;
    v_datensatz_id := NEW.id;
    -- Soft-Delete (Abschnitt 6, DSGVO-Grundlagen) ist technisch ein UPDATE,
    -- zählt fachlich aber als "gelöscht": Spalte wechselt von leer auf gesetzt.
    IF (v_alte_werte ->> 'deleted_at') IS NULL AND (v_neue_werte ->> 'deleted_at') IS NOT NULL THEN
      v_aktion := 'geloescht';
    ELSE
      v_aktion := 'geaendert';
    END IF;
  END IF;

  INSERT INTO aenderungsprotokoll (firma_id, user_id, tabelle, datensatz_id, aktion, alte_werte, neue_werte)
  VALUES (v_firma_id, v_user_id, TG_TABLE_NAME, v_datensatz_id, v_aktion, v_alte_werte, v_neue_werte);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Regel 3: nur Tabellen mit Spalte "id" annehmen.
CREATE OR REPLACE FUNCTION aenderungsprotokoll_aktivieren(p_tabelle regclass) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = p_tabelle AND attname = 'id' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Tabelle % hat keine Spalte "id" und kann nicht protokolliert werden', p_tabelle;
  END IF;

  EXECUTE format(
    'CREATE TRIGGER aenderungsprotokoll AFTER INSERT OR UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION aenderungsprotokoll_eintragen()',
    p_tabelle
  );
END;
$$ LANGUAGE plpgsql;

SELECT aenderungsprotokoll_aktivieren('users');
