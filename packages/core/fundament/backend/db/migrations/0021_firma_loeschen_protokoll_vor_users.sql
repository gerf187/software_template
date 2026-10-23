-- Bugfix Teil A (live aufgetreten): firma_endgueltig_loeschen() (Migration
-- 0020) löschte "aenderungsprotokoll" immer ganz zuletzt. Hat ein echter
-- Mitarbeiter irgendwann etwas geändert, verweist eine alte Protokollzeile
-- per user_id auf ihn -- beim Löschen von "users" (davor in der Reihenfolge)
-- schlägt das mit "violates foreign key constraint
-- aenderungsprotokoll_user_firma_fkey" fehl. Der bisherige Test hatte das
-- nicht gefunden, weil er Testdaten direkt per SQL einfügte: ohne echten
-- Login bleibt user_id dabei leer (siehe withFirma(), app.current_user_id).
--
-- Seit Migration 0014 schreibt zudem "users" selbst ins Änderungsprotokoll
-- (jede Löschzeile erzeugt einen neuen Eintrag). Darum reicht ein einfaches
-- Vorziehen nicht: "aenderungsprotokoll" muss zweimal geleert werden -- einmal
-- VOR der übrigen Lösch-Schleife (wegen des Fremdschlüssels auf "users") und
-- einmal danach wie bisher (um die beim Löschen von "users"/"firma_module"
-- gerade neu entstandenen Einträge zu entfernen, bevor "firmen" gelöscht
-- wird). Genau das macht der Test-Hilfsbefehl loescheTestfirma() schon
-- richtig (db/__tests__/helpers.js) -- diese Migration zieht die echte
-- Funktion auf dasselbe Muster.
CREATE OR REPLACE FUNCTION firma_endgueltig_loeschen(p_firma_id INT, p_name_bestaetigung TEXT, p_user_id INT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
  v_aktiv BOOLEAN;
  v_bereiche JSONB := '{}';
  v_tabelle TEXT;
  v_anzahl INT;
  v_protokoll_erste_runde INT;
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

  -- Erste Runde: alte Protokollzeilen weg, BEVOR "users" (und alles andere)
  -- gelöscht wird -- sonst blockiert deren Fremdschlüssel auf "users".
  DELETE FROM aenderungsprotokoll WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_protokoll_erste_runde = ROW_COUNT;

  FOREACH v_tabelle IN ARRAY firma_tabellen_loeschreihenfolge() LOOP
    IF v_tabelle = 'aenderungsprotokoll' THEN CONTINUE; END IF;
    EXECUTE format('DELETE FROM %I WHERE firma_id = $1', v_tabelle) USING p_firma_id;
    GET DIAGNOSTICS v_anzahl = ROW_COUNT;
    v_bereiche := v_bereiche || jsonb_build_object(v_tabelle, v_anzahl);
  END LOOP;

  -- Zweite Runde: "users" und "firma_module" haben durch ihre eigenen
  -- Trigger gerade neue Protokollzeilen erzeugt -- auch die müssen weg,
  -- bevor "firmen" gelöscht wird (aenderungsprotokoll.firma_id -> firmen).
  DELETE FROM aenderungsprotokoll WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_anzahl = ROW_COUNT;
  v_bereiche := v_bereiche || jsonb_build_object('aenderungsprotokoll', v_protokoll_erste_runde + v_anzahl);

  DELETE FROM firmen WHERE id = p_firma_id;

  INSERT INTO plattform_protokoll (user_id, firma_name, bereiche)
  VALUES (p_user_id, v_name, v_bereiche);

  RETURN v_bereiche;
END;
$$;

REVOKE ALL ON FUNCTION firma_endgueltig_loeschen(INT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION firma_endgueltig_loeschen(INT, TEXT, INT) TO app;
