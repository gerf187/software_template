-- benutzer_dashboard bekommt die Mandanten-Regel über die zentrale Funktion
-- (Migration 0006) statt einer eigenen, leicht abweichenden Kopie. Die
-- Funktion filtert auch einen leeren Firmen-Kontext sauber (NULLIF), statt
-- mit einem Umwandlungsfehler abzubrechen.

SELECT mandanten_trennung_aktivieren('benutzer_dashboard');
