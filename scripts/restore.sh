#!/bin/sh
# Datenbank aus einer Sicherung zurückspielen (Phase 3). Vorher einmal den
# Stack normal hochfahren lassen (Migrationen legen Rolle + Schema an) --
# erst danach restore.sh ausführen, siehe README "Betrieb".
set -eu

DATEI="${1:-}"
if [ -z "$DATEI" ]; then
  echo "Nutzung: restore.sh <dateiname-im-backups-ordner>"
  echo "Beispiel: restore.sh datenbank_2026-10-02_03-00-00.sql.gz"
  exit 1
fi

PFAD="/backups/${DATEI}"
if [ ! -f "$PFAD" ]; then
  PFAD="$DATEI"
fi
if [ ! -f "$PFAD" ]; then
  echo "Datei nicht gefunden: ${DATEI}"
  exit 1
fi

echo "ACHTUNG: Das überschreibt die Datenbank '${POSTGRES_DB}' komplett mit dem Stand aus:"
echo "  ${PFAD}"
echo "Alle Daten, die seither dazugekommen sind, gehen verloren."
printf "Zum Fortfahren groß JA eingeben: "
read -r BESTAETIGUNG
if [ "$BESTAETIGUNG" != "JA" ]; then
  echo "Abgebrochen, nichts wurde verändert."
  exit 1
fi

echo "[$(date)] Datenbank wird zurückgespielt..."
gunzip -c "$PFAD" | PGPASSWORD="${POSTGRES_PASSWORD}" psql -v ON_ERROR_STOP=1 \
  -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}"
echo "[$(date)] Fertig."
