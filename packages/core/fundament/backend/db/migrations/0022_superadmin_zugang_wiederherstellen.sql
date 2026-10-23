-- Teil D: Superadmin-Zugang wiederherstellen, falls das Passwort verloren
-- geht. "plattform_protokoll" (Migration 0019) war bisher fest auf "Firma
-- gelöscht" zugeschnitten (firma_name und bereiche beide Pflicht). Jetzt
-- protokollieren auch die neuen Befehle superadmin:passwort-zuruecksetzen und
-- superadmin:deaktivieren hier -- darum eine Spalte "aktion" (bestehende
-- Zeilen bekommen automatisch 'firma_geloescht') und "ziel_email" für die
-- betroffene E-Mail-Adresse. firma_name/bereiche sind für die neuen Aktionen
-- nicht sinnvoll, darum nicht mehr Pflicht.
ALTER TABLE plattform_protokoll
  ADD COLUMN aktion TEXT NOT NULL DEFAULT 'firma_geloescht',
  ADD COLUMN ziel_email TEXT;

ALTER TABLE plattform_protokoll ALTER COLUMN firma_name DROP NOT NULL;
ALTER TABLE plattform_protokoll ALTER COLUMN bereiche DROP NOT NULL;

ALTER TABLE plattform_protokoll ADD CONSTRAINT plattform_protokoll_aktion_check
  CHECK (aktion IN ('firma_geloescht', 'superadmin_passwort_zuruecksetzen', 'superadmin_deaktiviert'));
