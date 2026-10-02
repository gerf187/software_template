#!/bin/sh
# Tägliche Datenbanksicherung (Phase 3). --clean --if-exists --no-privileges:
# das Backup lässt sich direkt in eine bestehende (auch leere) Datenbank
# zurückspielen, ohne vorher Tabellen händisch zu löschen. Rechte für die
# Rolle "app" kommen beim Zurückspielen automatisch zurück (Migration 0001:
# ALTER DEFAULT PRIVILEGES gilt für neu angelegte Tabellen).
set -eu

mkdir -p /backups
ZEITSTEMPEL=$(date +%Y-%m-%d_%H-%M-%S)
ZIEL_DATEI="/backups/datenbank_${ZEITSTEMPEL}.sql.gz"

echo "[$(date)] Backup wird erstellt: ${ZIEL_DATEI}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" \
  --clean --if-exists --no-privileges \
  "${POSTGRES_DB}" | gzip > "${ZIEL_DATEI}"
echo "[$(date)] Backup fertig: $(du -h "${ZIEL_DATEI}" | cut -f1)"

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
