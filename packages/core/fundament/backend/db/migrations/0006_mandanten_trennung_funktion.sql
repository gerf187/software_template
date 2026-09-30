-- Die Regel "nur eigene Firma sehen" (RLS an + erzwingen + Policy) stand
-- für jede Tabelle einzeln wortgleich da. Jetzt einmal als Funktion
-- definiert -- ein künftiger Baustein braucht dafür nur eine Zeile:
--   SELECT mandanten_trennung_aktivieren('meine_neue_tabelle');
CREATE FUNCTION mandanten_trennung_aktivieren(p_tabelle regclass) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_tabelle);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_tabelle);
  EXECUTE format('DROP POLICY IF EXISTS firma_isolation ON %s', p_tabelle);
  EXECUTE format(
    $f$CREATE POLICY firma_isolation ON %s
       USING (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int)
       WITH CHECK (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int)$f$,
    p_tabelle
  );
END;
$$ LANGUAGE plpgsql;

SELECT mandanten_trennung_aktivieren('firma_module');
SELECT mandanten_trennung_aktivieren('users');
SELECT mandanten_trennung_aktivieren('rechte');
SELECT mandanten_trennung_aktivieren('aenderungsprotokoll');
SELECT mandanten_trennung_aktivieren('contacts');
SELECT mandanten_trennung_aktivieren('notes');
SELECT mandanten_trennung_aktivieren('tasks');
