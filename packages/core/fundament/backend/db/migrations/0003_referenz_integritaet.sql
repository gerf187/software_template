-- Schließt zwei Lücken, die der neue automatische Test (Teil B, Punkt 1+2)
-- gefunden hat.

-- 1) Eine Notiz oder Aufgabe konnte bisher auf einen Kontakt/Benutzer einer
--    anderen Firma verweisen, weil der einfache Fremdschlüssel nur prüft,
--    ob die Ziel-Zeile irgendwo existiert -- nicht, ob sie zur gleichen
--    Firma gehört. Zusammengesetzte Fremdschlüssel (firma_id, x) erzwingen
--    das jetzt direkt in der Datenbank, für alle Verweise und auch für
--    künftige Bausteine.

ALTER TABLE contacts ADD CONSTRAINT contacts_firma_id_id_key UNIQUE (firma_id, id);
ALTER TABLE users ADD CONSTRAINT users_firma_id_id_key UNIQUE (firma_id, id);

ALTER TABLE notes DROP CONSTRAINT notes_contact_id_fkey;
ALTER TABLE notes DROP CONSTRAINT notes_erstellt_von_fkey;
ALTER TABLE tasks DROP CONSTRAINT tasks_contact_id_fkey;
ALTER TABLE tasks DROP CONSTRAINT tasks_zustaendig_id_fkey;
ALTER TABLE contacts DROP CONSTRAINT contacts_empfohlen_von_kontakt_id_fkey;
ALTER TABLE aenderungsprotokoll DROP CONSTRAINT aenderungsprotokoll_user_id_fkey;
ALTER TABLE sessions DROP CONSTRAINT sessions_user_id_fkey;

ALTER TABLE notes ADD CONSTRAINT notes_contact_firma_fkey
  FOREIGN KEY (firma_id, contact_id) REFERENCES contacts (firma_id, id);
ALTER TABLE notes ADD CONSTRAINT notes_erstellt_von_firma_fkey
  FOREIGN KEY (firma_id, erstellt_von) REFERENCES users (firma_id, id);
ALTER TABLE tasks ADD CONSTRAINT tasks_contact_firma_fkey
  FOREIGN KEY (firma_id, contact_id) REFERENCES contacts (firma_id, id);
ALTER TABLE tasks ADD CONSTRAINT tasks_zustaendig_firma_fkey
  FOREIGN KEY (firma_id, zustaendig_id) REFERENCES users (firma_id, id);
ALTER TABLE contacts ADD CONSTRAINT contacts_empfohlen_von_firma_fkey
  FOREIGN KEY (firma_id, empfohlen_von_kontakt_id) REFERENCES contacts (firma_id, id);
ALTER TABLE aenderungsprotokoll ADD CONSTRAINT aenderungsprotokoll_user_firma_fkey
  FOREIGN KEY (firma_id, user_id) REFERENCES users (firma_id, id);
ALTER TABLE sessions ADD CONSTRAINT sessions_user_firma_fkey
  FOREIGN KEY (firma_id, user_id) REFERENCES users (firma_id, id);

-- 2) current_setting(..., true) liefert, nachdem die Transaktion zu Ende
--    ist, eine leere Zeichenkette statt "nichts" zurück (Postgres-Eigenheit
--    bei selbst erfundenen Einstellungsnamen). Die Umwandlung ''::int wirft
--    dann einen Fehler, statt sauber "kein Zugriff" zu bedeuten. NULLIF
--    macht daraus NULL -- "firma_id = NULL" ist immer falsch, ohne Absturz.

DROP POLICY firma_isolation ON firma_module;
CREATE POLICY firma_isolation ON firma_module
  USING (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int)
  WITH CHECK (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int);

DROP POLICY firma_isolation ON users;
CREATE POLICY firma_isolation ON users
  USING (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int)
  WITH CHECK (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int);

DROP POLICY firma_isolation ON rechte;
CREATE POLICY firma_isolation ON rechte
  USING (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int)
  WITH CHECK (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int);

DROP POLICY firma_isolation ON aenderungsprotokoll;
CREATE POLICY firma_isolation ON aenderungsprotokoll
  USING (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int)
  WITH CHECK (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int);

DROP POLICY firma_isolation ON contacts;
CREATE POLICY firma_isolation ON contacts
  USING (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int)
  WITH CHECK (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int);

DROP POLICY firma_isolation ON notes;
CREATE POLICY firma_isolation ON notes
  USING (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int)
  WITH CHECK (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int);

DROP POLICY firma_isolation ON tasks;
CREATE POLICY firma_isolation ON tasks
  USING (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int)
  WITH CHECK (firma_id = NULLIF(current_setting('app.current_firma_id', true), '')::int);
