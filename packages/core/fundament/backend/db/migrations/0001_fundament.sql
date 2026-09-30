-- Fundament-Schema: Firmen, Benutzer, Rechte, Protokoll, Kontakte.
-- Mandanten-Trennung: jede Fachtabelle hat firma_id und eine RLS-Regel,
-- die nur Zeilen der Firma aus der aktuellen Session zeigt (Abschnitt 6).

-- Eingeschränkte Rolle für den laufenden Betrieb. Der Eigentümer der Tabellen
-- (aus DATABASE_URL, z. B. "saas") bleibt der Migrations-Nutzer und darf RLS
-- umgehen -- genau deshalb läuft der Betrieb über diese separate Rolle.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app LOGIN PASSWORD 'app';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE saas TO app;
GRANT USAGE ON SCHEMA public TO app;

-- Alles, was ab jetzt in diesem Schema angelegt wird (auch von künftigen
-- Migrationen und Bausteinen), bekommt die Rolle "app" automatisch.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app;

-- Firmen (Mandanten). Kein RLS: wird nur von Superadmin-Routen verwaltet.
CREATE TABLE firmen (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  einstellungen JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Welche Bausteine eine Firma bekommen hat.
CREATE TABLE firma_module (
  firma_id INT NOT NULL REFERENCES firmen(id),
  modul TEXT NOT NULL,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  seit TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (firma_id, modul)
);

-- Benutzer. "Aktiv"/"Archiv" statt Löschen (Abschnitt 7).
CREATE TABLE users (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firma_id INT NOT NULL REFERENCES firmen(id),
  email TEXT NOT NULL,
  passwort_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  rolle TEXT NOT NULL,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_firma_email_unique ON users (firma_id, lower(email));

-- Sitzungen (Anhang A.4). id = SHA-256-Hash des Tokens, nie der Klartext.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_adresse INET,
  user_agent TEXT
);

-- Rechte-Matrix: pro Firma, Rolle und Bereich sehen/bearbeiten/löschen.
CREATE TABLE rechte (
  firma_id INT NOT NULL REFERENCES firmen(id),
  rolle TEXT NOT NULL,
  bereich TEXT NOT NULL,
  sehen BOOLEAN NOT NULL DEFAULT false,
  bearbeiten BOOLEAN NOT NULL DEFAULT false,
  loeschen BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (firma_id, rolle, bereich)
);

-- Änderungsprotokoll (Abschnitt 6). Wird nie geändert oder gelöscht.
CREATE TABLE aenderungsprotokoll (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firma_id INT NOT NULL REFERENCES firmen(id),
  user_id INT REFERENCES users(id),
  zeitpunkt TIMESTAMPTZ NOT NULL DEFAULT now(),
  tabelle TEXT NOT NULL,
  datensatz_id INT NOT NULL,
  aktion TEXT NOT NULL CHECK (aktion IN ('angelegt', 'geaendert', 'geloescht')),
  alte_werte JSONB,
  neue_werte JSONB
);

-- Kontakte (Abschnitt 11): Startpunkt, bevor es ein Projekt gibt.
CREATE TABLE contacts (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firma_id INT NOT NULL REFERENCES firmen(id),
  name TEXT NOT NULL,
  email TEXT,
  telefon TEXT,
  wohnadresse_strasse TEXT,
  wohnadresse_plz TEXT,
  wohnadresse_ort TEXT,
  objektadresse_strasse TEXT,
  objektadresse_plz TEXT,
  objektadresse_ort TEXT,
  empfohlen_von_kontakt_id INT REFERENCES contacts(id),
  empfohlen_von_text TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK (empfohlen_von_kontakt_id IS NULL OR empfohlen_von_text IS NULL)
);

-- Notizen direkt am Kontakt.
CREATE TABLE notes (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firma_id INT NOT NULL REFERENCES firmen(id),
  contact_id INT NOT NULL REFERENCES contacts(id),
  text TEXT NOT NULL,
  erstellt_von INT REFERENCES users(id),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Aufgaben: frei (am Kontakt) oder später aus einem Ablaufplan (step_key).
-- project_id verweist bewusst ohne Fremdschlüssel auf den Baustein "Projekte",
-- damit das Fundament nicht von einem Baustein abhängt (Abschnitt 8, Regel 5).
CREATE TABLE tasks (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firma_id INT NOT NULL REFERENCES firmen(id),
  contact_id INT REFERENCES contacts(id),
  project_id INT,
  zustaendig_id INT REFERENCES users(id),
  text TEXT NOT NULL,
  faellig_am DATE,
  status TEXT NOT NULL DEFAULT 'offen',
  step_key TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Mandanten-Trennung über Row Level Security (zweite Sicherheitsschicht).
-- app.current_firma_id wird pro Anfrage von der Anwendung gesetzt (siehe
-- src/db/withFirma.js). Ist der Wert nicht gesetzt, liefert die Abfrage
-- keine Zeilen -- sicher in der Grundeinstellung ("fail closed").
ALTER TABLE firma_module ENABLE ROW LEVEL SECURITY;
CREATE POLICY firma_isolation ON firma_module
  USING (firma_id = current_setting('app.current_firma_id', true)::int)
  WITH CHECK (firma_id = current_setting('app.current_firma_id', true)::int);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY firma_isolation ON users
  USING (firma_id = current_setting('app.current_firma_id', true)::int)
  WITH CHECK (firma_id = current_setting('app.current_firma_id', true)::int);

ALTER TABLE rechte ENABLE ROW LEVEL SECURITY;
CREATE POLICY firma_isolation ON rechte
  USING (firma_id = current_setting('app.current_firma_id', true)::int)
  WITH CHECK (firma_id = current_setting('app.current_firma_id', true)::int);

ALTER TABLE aenderungsprotokoll ENABLE ROW LEVEL SECURITY;
CREATE POLICY firma_isolation ON aenderungsprotokoll
  USING (firma_id = current_setting('app.current_firma_id', true)::int)
  WITH CHECK (firma_id = current_setting('app.current_firma_id', true)::int);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY firma_isolation ON contacts
  USING (firma_id = current_setting('app.current_firma_id', true)::int)
  WITH CHECK (firma_id = current_setting('app.current_firma_id', true)::int);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY firma_isolation ON notes
  USING (firma_id = current_setting('app.current_firma_id', true)::int)
  WITH CHECK (firma_id = current_setting('app.current_firma_id', true)::int);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY firma_isolation ON tasks
  USING (firma_id = current_setting('app.current_firma_id', true)::int)
  WITH CHECK (firma_id = current_setting('app.current_firma_id', true)::int);
