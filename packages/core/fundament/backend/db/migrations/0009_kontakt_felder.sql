-- Kontakt-Felder für die Oberfläche (Abschnitt 11): Anrede, Vorname/Nachname
-- getrennt statt eines Sammel-Namens, Firma/Organisation, Mobilnummer.
ALTER TABLE contacts ADD COLUMN anrede TEXT;
ALTER TABLE contacts ADD COLUMN vorname TEXT;
ALTER TABLE contacts ADD COLUMN nachname TEXT;
ALTER TABLE contacts ADD COLUMN organisation TEXT;
ALTER TABLE contacts ADD COLUMN mobil TEXT;

-- Bisherige Testdaten hatten nur einen Sammel-Namen -- als Nachname übernehmen,
-- damit nichts verloren geht.
UPDATE contacts SET nachname = name WHERE nachname IS NULL;
ALTER TABLE contacts ALTER COLUMN nachname SET NOT NULL;
ALTER TABLE contacts DROP COLUMN name;
