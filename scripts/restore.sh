#!/bin/sh
# Datenbank aus einer Sicherung zurückspielen (Phase 3). Vorher einmal den
# Stack normal hochfahren lassen (Migrationen legen Rolle + Schema an) --
# erst danach restore.sh ausführen, siehe README "Betrieb".
set -eu
set -o pipefail

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

# Verschlüsselte Sicherung (.age): der PRIVATE Schlüssel muss als Datei im
# Container liegen (BACKUP_ENTSCHLUESSELUNG_DATEI). Ohne ihn lieber gar nicht
# erst die Datenbank anfassen -- die Prüfung kommt daher vor der Abfrage.
case "$PFAD" in
  *.age)
    if [ -z "${BACKUP_ENTSCHLUESSELUNG_DATEI:-}" ] || [ ! -f "${BACKUP_ENTSCHLUESSELUNG_DATEI}" ]; then
      echo "FEHLER: Die Sicherung ist verschlüsselt. Bitte BACKUP_ENTSCHLUESSELUNG_DATEI auf die Datei mit dem privaten age-Schlüssel setzen."
      exit 1
    fi
    entschluesselt() { age -d -i "${BACKUP_ENTSCHLUESSELUNG_DATEI}" "$PFAD"; }
    ;;
  *)
    entschluesselt() { cat "$PFAD"; }
    ;;
esac

echo "ACHTUNG: Das überschreibt die Datenbank '${POSTGRES_DB}' komplett mit dem Stand aus:"
echo "  ${PFAD}"
echo "Alle Daten, die seither dazugekommen sind, gehen verloren."
printf "Zum Fortfahren groß JA eingeben: "
read -r BESTAETIGUNG
if [ "$BESTAETIGUNG" != "JA" ]; then
  echo "Abgebrochen, nichts wurde verändert."
  exit 1
fi

psql_befehl() {
  PGPASSWORD="${POSTGRES_PASSWORD}" psql -v ON_ERROR_STOP=1 \
    -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" "$@"
}

echo "[$(date)] Datenbank wird zurückgespielt..."
entschluesselt | gunzip -c | psql_befehl

# Rechte auf den Stand der Sicherung setzen. Die Standardrechte aus Migration
# 0001 geben der Rolle "app" beim Anlegen jeder Tabelle volle Rechte. Entzüge
# aus späteren Migrationen (z. B. 0008: kein UPDATE/DELETE auf dem Änderungs-
# protokoll) würden dadurch verloren gehen. Deshalb: erst alle Rechte der
# Rolle "app" auf Tabellen und Sequenzen entfernen, dann die GRANT-Zeilen aus
# der Sicherung neu anwenden. Danach entspricht der Stand genau dem Original.
echo "[$(date)] Rechte werden auf den Stand der Sicherung gesetzt..."
psql_befehl -c "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app;" >/dev/null
entschluesselt | gunzip -c | grep '^GRANT ' | psql_befehl >/dev/null
echo "[$(date)] Fertig."
