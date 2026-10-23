-- Teil B: Plattform-Verwaltungsdaten pro Firma (Abschnitt 7, Superadmin-Sicht,
-- KEINE Fachdaten). Kundennummer über eine eigene, dauerhafte Datenbank-Sequenz
-- (nie wiederverwendet, auch nicht nach einem endgültigen Löschen) -- bewusst
-- unabhängig von firmen.id, falls IDs technisch je migriert werden müssten.
-- Bestehende Firmen bekommen ihre Nummer gleich hier, in der Reihenfolge
-- ihres Anlegens (erstellt_am). Die übrigen Pflichtfelder (Straße, PLZ, Ort,
-- Ansprechpartner, Rechnungs-E-Mail) bleiben bei Bestandsfirmen zunächst
-- leer -- erzwungen wird das erst im Formular, beim nächsten Bearbeiten
-- (nicht hier als NOT NULL, sonst würde diese Migration selbst scheitern).
CREATE SEQUENCE kundennummer_seq;

ALTER TABLE firmen
  ADD COLUMN kundennummer TEXT,
  ADD COLUMN strasse TEXT,
  ADD COLUMN plz TEXT,
  ADD COLUMN ort TEXT,
  ADD COLUMN ansprechpartner TEXT,
  ADD COLUMN rechnungs_email TEXT,
  ADD COLUMN telefon TEXT,
  ADD COLUMN ust_id_nr TEXT,
  ADD COLUMN notiz TEXT;

WITH geordnet AS (
  SELECT id, 'K-' || lpad(row_number() OVER (ORDER BY erstellt_am, id)::text, 4, '0') AS nr
  FROM firmen
)
UPDATE firmen f SET kundennummer = g.nr FROM geordnet g WHERE f.id = g.id;

-- Sequenz dort weiterzählen lassen, wo die Bestandsfirmen aufgehört haben.
SELECT setval('kundennummer_seq', GREATEST((SELECT count(*) FROM firmen), 1), (SELECT count(*) FROM firmen) > 0);

ALTER TABLE firmen ALTER COLUMN kundennummer SET DEFAULT ('K-' || lpad(nextval('kundennummer_seq')::text, 4, '0'));
ALTER TABLE firmen ALTER COLUMN kundennummer SET NOT NULL;
ALTER TABLE firmen ADD CONSTRAINT firmen_kundennummer_unique UNIQUE (kundennummer);
