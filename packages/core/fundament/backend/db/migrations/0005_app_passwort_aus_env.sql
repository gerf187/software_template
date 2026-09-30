-- Das Passwort der eingeschränkten "app"-Rolle stand bisher fest im Code
-- (Migration 0001). Jetzt kommt es aus der Umgebung (.env), der
-- Migrations-Runner setzt den Platzhalter vor der Ausführung ein.
ALTER ROLE app WITH PASSWORD '__APP_DB_PASSWORD__';
