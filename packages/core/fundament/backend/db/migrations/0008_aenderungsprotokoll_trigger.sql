-- Änderungsprotokoll zentral und automatisch (Abschnitt 6): ein Trigger pro
-- Fachtabelle statt eines Protokoll-Aufrufs in jeder Route. Nach dem Muster
-- von mandanten_trennung_aktivieren() -- ein künftiger Baustein braucht dafür
-- nur: SELECT aenderungsprotokoll_aktivieren('meine_neue_tabelle').

CREATE FUNCTION aenderungsprotokoll_eintragen() RETURNS trigger AS $$
DECLARE
  v_user_id INT := NULLIF(current_setting('app.current_user_id', true), '')::int;
  v_aktion TEXT;
  v_firma_id INT;
  v_datensatz_id INT;
  v_alte_werte JSONB;
  v_neue_werte JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_alte_werte := to_jsonb(OLD);
    v_neue_werte := NULL;
    v_firma_id := OLD.firma_id;
    v_datensatz_id := OLD.id;
    v_aktion := 'geloescht';
  ELSIF TG_OP = 'INSERT' THEN
    v_alte_werte := NULL;
    v_neue_werte := to_jsonb(NEW);
    v_firma_id := NEW.firma_id;
    v_datensatz_id := NEW.id;
    v_aktion := 'angelegt';
  ELSE
    v_alte_werte := to_jsonb(OLD);
    v_neue_werte := to_jsonb(NEW);
    v_firma_id := NEW.firma_id;
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

CREATE FUNCTION aenderungsprotokoll_aktivieren(p_tabelle regclass) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER aenderungsprotokoll AFTER INSERT OR UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION aenderungsprotokoll_eintragen()',
    p_tabelle
  );
END;
$$ LANGUAGE plpgsql;

SELECT aenderungsprotokoll_aktivieren('contacts');
SELECT aenderungsprotokoll_aktivieren('notes');
SELECT aenderungsprotokoll_aktivieren('tasks');

-- Protokoll ist nur lesbar, nie änderbar oder löschbar -- auch nicht für
-- Admins (Abschnitt 6). Auf Datenbank-Ebene erzwungen, nicht nur im Code.
REVOKE UPDATE, DELETE ON aenderungsprotokoll FROM app;
