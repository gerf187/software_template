-- Zusätzliche Absicherung: FORCE ROW LEVEL SECURITY sorgt dafür, dass die
-- Mandanten-Trennung auch dann gilt, wenn eine Abfrage zufällig mit dem
-- Eigentümer-Nutzer der Tabellen liefe (normalerweise läuft der Betrieb
-- über die eingeschränkte Rolle "app", die das nicht braucht -- das hier
-- ist eine zweite Sicherung für den Fall eines künftigen Fehlers).
ALTER TABLE firma_module FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE rechte FORCE ROW LEVEL SECURITY;
ALTER TABLE aenderungsprotokoll FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
