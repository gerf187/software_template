#!/bin/sh
# Echter Test für Sicherung und Wiederherstellung (Phase 3). Jederzeit
# wiederholbar, arbeitet nur auf der Entwicklungs-Datenbank (.env) mit
# Demo-Daten -- niemals mit Kundendaten.
#
# Ablauf:
#  1. Demo-Daten einspielen (Werkstatt-Seed)
#  2. Zeilen je Tabelle zählen und Gesamt-Inhalt festhalten
#  3. Sicherung mit scripts/backup.sh erstellen (gleiches Skript wie im Betrieb)
#  4. Datenbank leeren (alle Tabellen im Schema public löschen)
#  5. Sicherung mit scripts/restore.sh zurückspielen
#  6. Zeilen erneut zählen, Inhalt vergleichen, App-Rolle prüfen
#
# Aufruf aus dem Projektordner: sh scripts/backup-test.sh
set -eu

if [ ! -f .env ]; then
  echo "FEHLER: .env fehlt. Zuerst: cp .env.example .env" >&2
  exit 1
fi
set -a
. ./.env
set +a

# Eigene Wegwerf-Datenbank für diesen Test: er leert sie und spielt das Backup
# zurück. Die Entwicklungs-Datenbank aus .env bleibt unberührt.
POSTGRES_DB=saas_backup_test
export POSTGRES_DB

DB_CONTAINER_NETZ="--network host"
ARBEITSORDNER=$(mktemp -d)

# Sicherung und Wiederherstellung laufen im gebauten Produktions-Image
# (docker/backup.Dockerfile, mit age). VERSCHLUESSELT=1 testet zusätzlich die
# Verschlüsselung mit einem frisch erzeugten Test-Schlüsselpaar.
BACKUP_BILD=swt-backup-test
VERSCHLUESSELT="${VERSCHLUESSELT:-0}"
docker build -q -f docker/backup.Dockerfile -t "$BACKUP_BILD" . >/dev/null
TABELLEN="firmen users sessions login_versuche rechte firma_module aenderungsprotokoll contacts notes tasks benutzer_dashboard"

# Postgres-Werkzeuge aus dem offiziellen Image, gleiche Version wie im Betrieb
psql_als() {
  # $1 = Benutzer, $2 = Passwort, $3 = SQL
  docker run --rm $DB_CONTAINER_NETZ -e PGPASSWORD="$2" postgres:16-alpine \
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$1" -d "$POSTGRES_DB" -tAX -c "$3"
}
sql() {
  psql_als "$POSTGRES_USER" "$POSTGRES_PASSWORD" "$1"
}

zaehle() {
  for T in $TABELLEN; do
    printf "%-22s %s\n" "$T" "$(sql "SELECT count(*) FROM $T")"
  done
}

# Inhalt als Datenzeilen, sortiert: die Reihenfolge der Zeilen ist in
# Postgres nicht garantiert, nur der Inhalt zählt. Die Warnung zu
# zirkulären Fremdschlüsseln betrifft nur dieses Vergleichs-Abbild (das
# echte Backup nutzt den vollständigen Dump), deshalb wird sie ausgeblendet.
# \restrict/\unrestrict enthalten bei jedem Dump einen neuen Zufallswert.
inhalt() {
  docker run --rm $DB_CONTAINER_NETZ -e PGPASSWORD="$POSTGRES_PASSWORD" postgres:16-alpine \
    pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" --data-only --inserts "$POSTGRES_DB" 2>/dev/null \
    | grep -v -e '^--' -e '^\\restrict' -e '^\\unrestrict' | sort
}

# Das Änderungsprotokoll darf die App-Rolle nicht ändern oder löschen
# (Migration 0008: REVOKE UPDATE, DELETE). Die Prüfung läuft als App-Rolle;
# "WHERE false" ändert nichts, die Rechteprüfung greift trotzdem.
schreibschutz() {
  if psql_als "$APP_DB_USER" "$APP_DB_PASSWORD" "UPDATE aenderungsprotokoll SET aktion = aktion WHERE false" >/dev/null 2>&1 \
     || psql_als "$APP_DB_USER" "$APP_DB_PASSWORD" "DELETE FROM aenderungsprotokoll WHERE false" >/dev/null 2>&1; then
    echo "NICHT gesperrt (App darf Protokoll ändern oder löschen)"
  else
    echo "gesperrt"
  fi
}

aufraeumen() {
  # Root-Dateien aus dem Backup-Container entfernen, dann den Ordner
  docker run --rm -v "$ARBEITSORDNER:/d" postgres:16-alpine sh -c 'rm -rf /d/* /d/.[!.]* 2>/dev/null' || true
  rmdir "$ARBEITSORDNER" 2>/dev/null || true
  # Wegwerf-Datenbank wieder entfernen (nie die Entwicklungs-Datenbank)
  docker run --rm $DB_CONTAINER_NETZ -e PGPASSWORD="$POSTGRES_PASSWORD" postgres:16-alpine \
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -tAX \
    -c "DROP DATABASE IF EXISTS saas_backup_test" >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

# Wie im Betrieb: Skripte laufen im Image mit /backups als Ordner
backup_lauf() {
  VERSCHL=""
  if [ "$VERSCHLUESSELT" = 1 ]; then
    VERSCHL="-e BACKUP_VERSCHLUESSELUNG_SCHLUESSEL=$PUBKEY"
  fi
  docker run --rm $DB_CONTAINER_NETZ $VERSCHL \
    -e POSTGRES_HOST="$POSTGRES_HOST" -e POSTGRES_PORT="$POSTGRES_PORT" \
    -e POSTGRES_DB="$POSTGRES_DB" -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" -e BACKUP_AUFBEWAHRUNG_TAGE=14 \
    -v "$ARBEITSORDNER:/backups" -v "$PWD/scripts:/skripte:ro" \
    "$BACKUP_BILD" sh /skripte/backup.sh
}

restore_lauf() {
  # $1 = Dateiname im Arbeitsordner; "JA" beantwortet die Sicherheitsabfrage
  ENTSCHL=""
  if [ "$VERSCHLUESSELT" = 1 ]; then
    ENTSCHL="-e BACKUP_ENTSCHLUESSELUNG_DATEI=/backups/schluessel.txt"
  fi
  echo "JA" | docker run --rm -i $DB_CONTAINER_NETZ $ENTSCHL \
    -e POSTGRES_HOST="$POSTGRES_HOST" -e POSTGRES_PORT="$POSTGRES_PORT" \
    -e POSTGRES_DB="$POSTGRES_DB" -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -v "$ARBEITSORDNER:/backups" -v "$PWD/scripts:/skripte:ro" \
    "$BACKUP_BILD" sh /skripte/restore.sh "$1"
}

echo "== 1. Wegwerf-Datenbank $POSTGRES_DB anlegen, Schema und Demo-Daten einspielen"
docker run --rm $DB_CONTAINER_NETZ -e PGPASSWORD="$POSTGRES_PASSWORD" postgres:16-alpine \
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -tAX \
  -c "DROP DATABASE IF EXISTS $POSTGRES_DB" -c "CREATE DATABASE $POSTGRES_DB" >/dev/null
npm run db:migrate --workspace packages/core/fundament/backend >/dev/null
npm run db:seed:werkstatt --workspace packages/core/fundament/backend >/dev/null
echo "   fertig"

echo "== 2. Zeilen vor der Sicherung"
zaehle | tee "$ARBEITSORDNER/vorher.txt"
echo "   Schreibschutz Protokoll vorher: $(schreibschutz)"
if [ "$(schreibschutz)" != "gesperrt" ]; then
  echo "ABBRUCH: Ausgangszustand ist falsch -- der Schreibschutz des Protokolls fehlt schon vor der Sicherung." >&2
  exit 1
fi
# Inhalt (ohne Kommentarzeilen mit Erstellungsdatum) festhalten
inhalt > "$ARBEITSORDNER/inhalt_vorher.sql"

echo "== 3. Sicherung erstellen"
if [ "$VERSCHLUESSELT" = 1 ]; then
  # Test-Schlüsselpaar: privater Teil nur im Arbeitsordner, öffentlicher Teil für die Sicherung
  docker run --rm -v "$ARBEITSORDNER:/backups" "$BACKUP_BILD" age-keygen -o /backups/schluessel.txt >/dev/null 2>&1
  PUBKEY=$(docker run --rm -v "$ARBEITSORDNER:/backups" "$BACKUP_BILD" age-keygen -y /backups/schluessel.txt)
  echo "   Verschlüsselung: Test-Schlüssel erzeugt (${PUBKEY%"${PUBKEY#????????}"}...)"
fi
backup_lauf
SICHERUNG=$(ls "$ARBEITSORDNER"/datenbank_*.sql.gz* | head -1)
SICHERUNG=$(basename "$SICHERUNG")
echo "   Datei: $SICHERUNG"
if [ "$VERSCHLUESSELT" = 1 ]; then
  case "$SICHERUNG" in
    *.age) echo "   Endung .age: ja" ;;
    *) echo "   Endung .age: NEIN"; exit 1 ;;
  esac
  # Ohne Schlüssel darf die Datei kein gepacktes SQL sein (kein Klartext)
  if docker run --rm -v "$ARBEITSORDNER:/d" postgres:16-alpine gzip -t "/d/$SICHERUNG" >/dev/null 2>&1; then
    echo "   Klartext-Prüfung: FEHLER, die Datei ist NICHT verschlüsselt"; exit 1
  else
    echo "   Klartext-Prüfung: verschlüsselt (kein gzip ohne Schlüssel lesbar)"
  fi
fi

echo "== 4. Datenbank leeren"
sql "DO \$\$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename); END LOOP; END \$\$;" >/dev/null
echo "   Tabellen im Schema public nach dem Leeren: $(sql "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"

echo "== 5. Sicherung zurückspielen"
restore_lauf "$SICHERUNG" | grep -E "Fertig|FEHLER|ERROR|Abgebrochen" || true

echo "== 6. Zeilen nach der Wiederherstellung"
echo "   Tabellen im Schema public: $(sql "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
zaehle | tee "$ARBEITSORDNER/nachher.txt"
SCHREIBSCHUTZ_NACHHER=$(schreibschutz)
echo "   Schreibschutz Protokoll nachher: $SCHREIBSCHUTZ_NACHHER"
inhalt > "$ARBEITSORDNER/inhalt_nachher.sql"

echo "== 7. Vergleich"
FEHLER=0
if diff -q "$ARBEITSORDNER/vorher.txt" "$ARBEITSORDNER/nachher.txt" >/dev/null; then
  echo "   Zeilen je Tabelle: identisch"
else
  echo "   Zeilen je Tabelle: UNTERSCHIEDLICH"; FEHLER=1
fi
if diff -q "$ARBEITSORDNER/inhalt_vorher.sql" "$ARBEITSORDNER/inhalt_nachher.sql" >/dev/null; then
  echo "   Inhalt (alle Datenzeilen): identisch"
else
  echo "   Inhalt (alle Datenzeilen): UNTERSCHIEDLICH. Erste Abweichungen:"
  diff "$ARBEITSORDNER/inhalt_vorher.sql" "$ARBEITSORDNER/inhalt_nachher.sql" | head -20
  FEHLER=1
fi

# Die eingeschränkte App-Rolle muss nach der Wiederherstellung wieder lesen dürfen
if psql_als "$APP_DB_USER" "$APP_DB_PASSWORD" "SELECT count(*) FROM firmen" >/dev/null 2>&1; then
  echo "   App-Rolle '${APP_DB_USER}' darf wieder lesen: ja"
else
  echo "   App-Rolle '${APP_DB_USER}' darf wieder lesen: NEIN"; FEHLER=1
fi

if [ "$SCHREIBSCHUTZ_NACHHER" = "gesperrt" ]; then
  echo "   Schreibschutz Protokoll nach Wiederherstellung: gesperrt"
else
  echo "   Schreibschutz Protokoll nach Wiederherstellung: NICHT gesperrt"; FEHLER=1
fi

if [ "$FEHLER" -eq 0 ]; then
  echo "ERGEBNIS: Sicherung und Wiederherstellung erfolgreich."
else
  echo "ERGEBNIS: FEHLGESCHLAGEN." >&2
  exit 1
fi
