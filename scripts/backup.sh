#!/bin/sh
# Tägliche Datenbanksicherung (Phase 3). --clean --if-exists --no-privileges:
# das Backup lässt sich direkt in eine bestehende (auch leere) Datenbank
# zurückspielen, ohne vorher Tabellen händisch zu löschen. Rechte für die
# Rolle "app" kommen beim Zurückspielen automatisch zurück (Migration 0001:
# ALTER DEFAULT PRIVILEGES gilt für neu angelegte Tabellen).
#
# Ablauf: pg_dump schreibt zuerst in eine Arbeitsdatei (ohne Pipe, damit ein
# Fehler von pg_dump nicht verschluckt wird). Erst wenn alles geprüft ist,
# bekommt die Sicherung ihren endgültigen Namen. Ein Fehler bricht mit
# Exit-Code 1 ab und lässt keine leere Datei zurück.
set -eu

mkdir -p /backups
ZEITSTEMPEL=$(date +%Y-%m-%d_%H-%M-%S)
ZIEL_DATEI="/backups/datenbank_${ZEITSTEMPEL}.sql.gz"
ARBEIT_SQL="/backups/.arbeit_${ZEITSTEMPEL}.sql"
ARBEIT_GZ="/backups/.arbeit_${ZEITSTEMPEL}.sql.gz"

# Diese Tabellen müssen im Dump vorkommen (Fundament). Neue Tabellen müssen
# nicht eingetragen werden; fehlt aber eine dieser, ist das Backup unbrauchbar.
ERWARTETE_TABELLEN="firmen users sessions login_versuche rechte firma_module aenderungsprotokoll contacts notes tasks benutzer_dashboard"

abbruch() {
  echo "[$(date)] FEHLER: Backup fehlgeschlagen -- ${1}" >&2
  echo "[$(date)] Es wurde KEIN neues Backup angelegt. Alte Backups bleiben unverändert." >&2
  rm -f "$ARBEIT_SQL" "$ARBEIT_GZ"
  exit 1
}

echo "[$(date)] Backup wird erstellt: ${ZIEL_DATEI}"

if ! PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" \
  --clean --if-exists --no-privileges \
  "${POSTGRES_DB}" > "$ARBEIT_SQL"; then
  abbruch "pg_dump konnte die Datenbank nicht lesen (Verbindung, Passwort oder Datenbankname prüfen)"
fi

if [ ! -s "$ARBEIT_SQL" ]; then
  abbruch "der Dump ist leer"
fi

for TABELLE in $ERWARTETE_TABELLEN; do
  if ! grep -q "^CREATE TABLE public\.${TABELLE} " "$ARBEIT_SQL"; then
    abbruch "Tabelle '${TABELLE}' fehlt im Dump"
  fi
done

if ! gzip -c "$ARBEIT_SQL" > "$ARBEIT_GZ"; then
  abbruch "Komprimierung mit gzip ist fehlgeschlagen"
fi
if ! gzip -t "$ARBEIT_GZ"; then
  abbruch "die gepackte Datei ist beschädigt"
fi
if [ ! -s "$ARBEIT_GZ" ]; then
  abbruch "die gepackte Datei ist leer"
fi

mv "$ARBEIT_GZ" "$ZIEL_DATEI"
rm -f "$ARBEIT_SQL"
echo "[$(date)] Backup geprüft und fertig: $(du -h "${ZIEL_DATEI}" | cut -f1), alle Tabellen vorhanden."

AUFBEWAHRUNG="${BACKUP_AUFBEWAHRUNG_TAGE:-14}"
echo "[$(date)] Lösche Backups älter als ${AUFBEWAHRUNG} Tage..."
find /backups -name "datenbank_*.sql.gz" -mtime "+${AUFBEWAHRUNG}" -delete

if [ -n "${BACKUP_ZIEL:-}" ]; then
  echo "[$(date)] Kopiere nach ${BACKUP_ZIEL} ..."
  if rsync -a "${ZIEL_DATEI}" "${BACKUP_ZIEL}/"; then
    echo "[$(date)] Externe Kopie fertig."
  else
    echo "[$(date)] WARNUNG: externe Kopie fehlgeschlagen, Backup liegt nur lokal in ./backups."
  fi
else
  echo "[$(date)] Kein BACKUP_ZIEL gesetzt (.env) -- Backup bleibt nur lokal in ./backups. Für eine echte externe Sicherung dort ein Ziel eintragen."
fi
