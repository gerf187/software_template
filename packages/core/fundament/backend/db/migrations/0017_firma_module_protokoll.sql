-- firma_module bekommt eine eigene Datensatz-Nummer, damit das Änderungsprotokoll
-- Baustein ein/aus festhalten kann (Abschnitt 6). Die bisherige Schlüssel-Kombination
-- (firma_id, modul) bleibt als Primärschlüssel erhalten.

ALTER TABLE firma_module ADD COLUMN id SERIAL;
ALTER TABLE firma_module ADD CONSTRAINT firma_module_id_eindeutig UNIQUE (id);

SELECT aenderungsprotokoll_aktivieren('firma_module');
