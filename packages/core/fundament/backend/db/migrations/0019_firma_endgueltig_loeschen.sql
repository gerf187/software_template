-- Firma endgültig löschen (Abschnitt 6/7, Punkt 0.4): nur für bereits gesperrte
-- Firmen, mit exakter Namens-Bestätigung. Löscht alle Daten der Firma. Die
-- App-Rolle darf aenderungsprotokoll nicht löschen (Migration 0008) -- daher
-- eine eng begrenzte SECURITY-DEFINER-Funktion, die nur genau diesen einen
-- Vorgang kann, statt die ganze Tabelle für "app" zu öffnen.
--
-- Reihenfolge wie beim Test-Aufräumen (db/__tests__/helpers.js): Fachtabellen
-- zuerst, aenderungsprotokoll erst zum Schluss (davor lösen die Löschungen
-- selbst wieder Protokoll-Einträge über den Trigger aus, Migration 0008/0014/0017).

CREATE TABLE plattform_protokoll (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- ON DELETE SET NULL: das Protokoll bleibt dauerhaft, auch wenn ein
  -- Superadmin-Konto irgendwann wegfällt (anders als die Fachtabellen gehört
  -- dieses Protokoll zu keiner Firma und wird nie mitgelöscht).
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  zeitpunkt TIMESTAMPTZ NOT NULL DEFAULT now(),
  firma_name TEXT NOT NULL,
  bereiche JSONB NOT NULL
);
-- Kein Firmenbezug (Abschnitt 7: Superadmin sieht keine Fachdaten der Firmen) --
-- kein RLS nötig, wie bei "firmen" selbst. Wie das Änderungsprotokoll (Migration
-- 0008): nie änderbar oder löschbar, auch nicht für Superadmin.
REVOKE UPDATE, DELETE ON plattform_protokoll FROM app;

CREATE FUNCTION firma_endgueltig_loeschen(p_firma_id INT, p_name_bestaetigung TEXT, p_user_id INT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
  v_aktiv BOOLEAN;
  v_aufgaben INT;
  v_notizen INT;
  v_kontakte INT;
  v_dashboard INT;
  v_sitzungen INT;
  v_rechte INT;
  v_bausteine INT;
  v_mitarbeiter INT;
  v_protokoll INT;
  v_bereiche JSONB;
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

  DELETE FROM tasks WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_aufgaben = ROW_COUNT;
  DELETE FROM notes WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_notizen = ROW_COUNT;
  DELETE FROM contacts WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_kontakte = ROW_COUNT;
  DELETE FROM benutzer_dashboard WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_dashboard = ROW_COUNT;
  DELETE FROM sessions WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_sitzungen = ROW_COUNT;
  -- Login-Fehlversuche hängen an der E-Mail, nicht an firma_id (E-Mails sind
  -- installationsweit eindeutig, Abschnitt 6) -- vor dem Löschen der Nutzer.
  DELETE FROM login_versuche WHERE lower(email) IN (
    SELECT lower(email) FROM users WHERE firma_id = p_firma_id
  );
  DELETE FROM rechte WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_rechte = ROW_COUNT;
  DELETE FROM firma_module WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_bausteine = ROW_COUNT;
  DELETE FROM users WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_mitarbeiter = ROW_COUNT;
  -- Zum Schluss: deckt die ursprüngliche Historie UND alles ab, was die
  -- obigen Löschungen selbst gerade erst protokolliert haben.
  DELETE FROM aenderungsprotokoll WHERE firma_id = p_firma_id;
  GET DIAGNOSTICS v_protokoll = ROW_COUNT;
  DELETE FROM firmen WHERE id = p_firma_id;

  v_bereiche := jsonb_build_object(
    'kontakte', v_kontakte,
    'notizen', v_notizen,
    'aufgaben', v_aufgaben,
    'mitarbeiter', v_mitarbeiter,
    'sitzungen', v_sitzungen,
    'rechte', v_rechte,
    'bausteine', v_bausteine,
    'dashboard', v_dashboard,
    'aenderungsprotokoll', v_protokoll
  );

  INSERT INTO plattform_protokoll (user_id, firma_name, bereiche)
  VALUES (p_user_id, v_name, v_bereiche);

  RETURN v_bereiche;
END;
$$;

REVOKE ALL ON FUNCTION firma_endgueltig_loeschen(INT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION firma_endgueltig_loeschen(INT, TEXT, INT) TO app;
