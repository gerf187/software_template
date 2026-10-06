-- "Empfohlen von" ist entfernt (Entscheidung Björn). Spalten, Fremdschlüssel und
-- Prüfregel weg. Altes Änderungsprotokoll bleibt unverändert; die Anzeige blendet
-- Einträge mit entfernten Feldern aus (kontakte/routes.js).

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_empfohlen_von_firma_fkey;
ALTER TABLE contacts DROP COLUMN IF EXISTS empfohlen_von_kontakt_id;
ALTER TABLE contacts DROP COLUMN IF EXISTS empfohlen_von_text;
