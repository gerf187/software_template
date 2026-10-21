-- Bugfix (Teil A): firma_endgueltig_loeschen() (Migration 0019) kannte nur eine
-- feste Liste von Fachtabellen und löschte "projects" (Baustein "Projekte")
-- nicht mit. Hatte eine Firma Projekte, blockierte das die ganze Funktion
-- (Fremdschlüssel projects -> contacts). Jeder künftige Baustein mit eigener
-- firma_id-Tabelle hätte denselben Fehler wieder ausgelöst, weil die Funktion
-- jedes Mal von Hand hätte ergänzt werden müssen -- genau das soll nicht mehr
-- nötig sein (Abschnitt 8, Regel 5: das Fundament kennt Bausteine nicht).
--
-- Fix: Die Funktion ermittelt die zu löschenden Tabellen jetzt selbst über
-- information_schema (alle Tabellen mit Spalte firma_id, außer "firmen" und
-- "plattform_protokoll") und bringt sie anhand der Fremdschlüssel (pg_constraint)
-- in eine gültige Löschreihenfolge -- abhängige Tabellen zuerst. "aenderungsprotokoll"
-- bekommt durch die Trigger (Migration 0008/0014/0017, Baustein-Migrationen)
-- bei jeder der obigen Löschungen neue Einträge, deshalb bleibt es wie bisher
-- als letzte Fachtabelle vor "firmen" stehen.

CREATE FUNCTION firma_tabellen_loeschreihenfolge() RETURNS TEXT[]
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_uebrig TEXT[];
  v_ergebnis TEXT[] := '{}';
  v_tabelle TEXT;
  v_gefunden BOOLEAN;
BEGIN
  SELECT array_agg(table_name ORDER BY table_name) INTO v_uebrig
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'firma_id'
    -- "aenderungsprotokoll" immer zuletzt (siehe oben), "firmen" und
    -- "plattform_protokoll" gehören nicht zu den Fachtabellen einer Firma.
    AND table_name NOT IN ('firmen', 'plattform_protokoll', 'aenderungsprotokoll');

  WHILE coalesce(array_length(v_uebrig, 1), 0) > 0 LOOP
    v_gefunden := FALSE;
    FOREACH v_tabelle IN ARRAY v_uebrig LOOP
      -- v_tabelle darf gelöscht werden, sobald keine andere noch übrige
      -- Tabelle per Fremdschlüssel auf sie zeigt (eigene Fremdschlüssel auf
      -- sich selbst zählen nicht -- eine Tabelle komplett zu leeren verletzt
      -- so einen Fremdschlüssel nie).
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint con
        WHERE con.contype = 'f'
          AND con.confrelid = v_tabelle::regclass
          AND con.conrelid <> v_tabelle::regclass
          AND con.conrelid::regclass::text = ANY (v_uebrig)
      ) THEN
        v_ergebnis := v_ergebnis || v_tabelle;
        v_uebrig := array_remove(v_uebrig, v_tabelle);
        v_gefunden := TRUE;
        EXIT;
      END IF;
    END LOOP;
    IF NOT v_gefunden THEN
      RAISE EXCEPTION 'Zyklische Fremdschlüssel zwischen firma_id-Tabellen (%), Löschreihenfolge nicht bestimmbar.',
        array_to_string(v_uebrig, ', ');
    END IF;
  END LOOP;

  RETURN array_append(v_ergebnis, 'aenderungsprotokoll');
END;
$$;

REVOKE ALL ON FUNCTION firma_tabellen_loeschreihenfolge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION firma_tabellen_loeschreihenfolge() TO app;

CREATE OR REPLACE FUNCTION firma_endgueltig_loeschen(p_firma_id INT, p_name_bestaetigung TEXT, p_user_id INT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
  v_aktiv BOOLEAN;
  v_bereiche JSONB := '{}';
  v_tabelle TEXT;
  v_anzahl INT;
BEGIN
  SELECT name, aktiv INTO v_name, v_aktiv FROM firmen WHERE id = p_firma_id FOR UPDATE;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Firma nicht gefunden.';
  END IF;
  IF v_aktiv THEN
    RAISE EXCEPTION 'Firma ist aktiv -- erst sperren.';
  END IF;
  IF v_name != p_name_bestaetigung THEN
    RAISE EXCEPTION 'Firmenname stimmt nicht.';
  END IF;

  -- Login-Fehlversuche hängen an der E-Mail, nicht an firma_id (E-Mails sind
  -- installationsweit eindeutig, Abschnitt 6) -- vor dem Löschen der Nutzer.
  DELETE FROM login_versuche WHERE lower(email) IN (
    SELECT lower(email) FROM users WHERE firma_id = p_firma_id
  );

  FOREACH v_tabelle IN ARRAY firma_tabellen_loeschreihenfolge() LOOP
    EXECUTE format('DELETE FROM %I WHERE firma_id = $1', v_tabelle) USING p_firma_id;
    GET DIAGNOSTICS v_anzahl = ROW_COUNT;
    v_bereiche := v_bereiche || jsonb_build_object(v_tabelle, v_anzahl);
  END LOOP;

  DELETE FROM firmen WHERE id = p_firma_id;

  INSERT INTO plattform_protokoll (user_id, firma_name, bereiche)
  VALUES (p_user_id, v_name, v_bereiche);

  RETURN v_bereiche;
END;
$$;

REVOKE ALL ON FUNCTION firma_endgueltig_loeschen(INT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION firma_endgueltig_loeschen(INT, TEXT, INT) TO app;
