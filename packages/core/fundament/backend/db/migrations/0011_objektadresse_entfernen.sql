-- Objektadresse gehört nicht an den Kontakt (Abschnitt 11): ein Kunde kann
-- mehrere Objekte haben. Die Objektadresse entsteht künftig am Projekt/Auftrag.
ALTER TABLE contacts DROP COLUMN objektadresse_strasse;
ALTER TABLE contacts DROP COLUMN objektadresse_plz;
ALTER TABLE contacts DROP COLUMN objektadresse_ort;
