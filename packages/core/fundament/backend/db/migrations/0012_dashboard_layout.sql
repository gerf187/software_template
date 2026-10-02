-- Dashboard-Kacheln (Abschnitt 8/10): jeder Benutzer darf seine Startseite
-- anpassen (ein-/ausblenden, sortieren, Größe). layout ist eine JSONB-Liste
-- [{ key, sichtbar, groesse }, ...] in Anzeige-Reihenfolge. Fehlt die Zeile,
-- gilt der Firmen-Standard (firmen.einstellungen.dashboardStandard), sonst
-- die eingebaute Grundeinstellung (Abschnitt 8).
CREATE TABLE benutzer_dashboard (
  user_id INT PRIMARY KEY REFERENCES users(id),
  firma_id INT NOT NULL REFERENCES firmen(id),
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE benutzer_dashboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY firma_isolation ON benutzer_dashboard
  USING (firma_id = current_setting('app.current_firma_id', true)::int)
  WITH CHECK (firma_id = current_setting('app.current_firma_id', true)::int);
ALTER TABLE benutzer_dashboard FORCE ROW LEVEL SECURITY;
