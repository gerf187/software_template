-- Baustein "Projekte" (Abschnitt 5/Teil 1): branchenneutraler Rahmen für
-- Projekt-Akten. Läuft als Baustein-Migration (migrate.js, Abschnitt 8) nach
-- den Fundament-Migrationen.

-- Zusammengesetzter Fremdschlüssel firma_id+contact_id (Teil 1, Punkt 1):
-- den dafür nötigen Unique-Index auf contacts (firma_id, id) gibt es schon
-- (Migration 0003_referenz_integritaet.sql, gleiches Muster wie bei
-- notes/tasks -> contacts dort).

CREATE TABLE projects (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firma_id INT NOT NULL REFERENCES firmen(id),
  contact_id INT NOT NULL,
  -- Projekt und Kontakt müssen zur selben Firma gehören -- sonst könnte ein
  -- Projekt versehentlich (oder über eine manipulierte Anfrage) an einen
  -- fremden Kontakt gehängt werden (Abschnitt 6, zweite Sicherheitsschicht
  -- zusätzlich zur Mandanten-Trennung über RLS).
  FOREIGN KEY (firma_id, contact_id) REFERENCES contacts (firma_id, id),
  name TEXT NOT NULL,
  -- Projektart(en), Mehrfachauswahl (Teil 1, Punkt 2/3) -- die zulässigen
  -- Werte kommen aus app.config.js, nicht aus der Datenbank.
  arten TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  objektadresse_strasse TEXT,
  objektadresse_plz TEXT,
  objektadresse_ort TEXT,
  auftragsdatum DATE,
  -- Nur http/https (Teil 1, Punkt 1) -- zusätzlich zur Prüfung in der Route,
  -- damit das nie allein vom Anwendungscode abhängt.
  ablage_link TEXT CHECK (ablage_link IS NULL OR ablage_link ~* '^https?://'),
  pausiert_grund TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
-- Für die Fremdschlüssel aus tasks/notes weiter unten.
ALTER TABLE projects ADD CONSTRAINT projects_firma_id_id_key UNIQUE (firma_id, id);

SELECT mandanten_trennung_aktivieren('projects');
SELECT aenderungsprotokoll_aktivieren('projects');

-- notes/tasks bekommen den Bezug zum Projekt (Teil 1, Punkt 1). tasks hatte
-- project_id schon vorbereitet, aber bewusst ohne Fremdschlüssel angelegt
-- (Migration 0001: "damit das Fundament nicht von einem Baustein abhängt").
-- Jetzt, wo es den Baustein gibt, ergänzt genau dieser Baustein die
-- Integritäts-Prüfung für seine eigene Tabelle -- das Fundament selbst bleibt
-- unverändert und bräuchte "projects" nie zur Laufzeit abzufragen (Abschnitt 8,
-- Regel 5: kein Baustein-Code greift in Fundament-Tabellen, aber ein Baustein
-- darf beim Einbau seine eigene Fremdschlüssel-Beziehung ergänzen). NULL
-- (Aufgaben/Notizen ohne Projektbezug) ist von der Prüfung unberührt.
ALTER TABLE tasks ADD CONSTRAINT tasks_firma_project_fkey
  FOREIGN KEY (firma_id, project_id) REFERENCES projects (firma_id, id);

ALTER TABLE notes ADD COLUMN project_id INT;
ALTER TABLE notes ADD CONSTRAINT notes_firma_project_fkey
  FOREIGN KEY (firma_id, project_id) REFERENCES projects (firma_id, id);
