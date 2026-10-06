#!/bin/sh
# Update-Ablauf (Phase 3, Abschnitt 2 Regel 4 / Abschnitt 6):
#   1. Backup (muss gelingen)   2. neue Version holen   3. Images bauen
#   4. Datenbank-Migrationen    5. App neu starten       6. Health-Check
# Bei einem Fehler wird abgebrochen und gemeldet. Nichts wird automatisch
# zurückgedreht. Kurze Unterbrechung (Neustart der App) ist beabsichtigt.
set -eu

# Immer aus dem Projektordner heraus arbeiten, egal von wo das Skript aufgerufen wird.
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ABBRUCH: .env fehlt. Siehe README, Abschnitt 'Server vorbereiten'." >&2
  exit 1
fi

# Projektname aus der .env (z. B. eb). Trennt die Images dieser Installation
# von denen anderer Installationen auf demselben Server.
INSTALLATION=$(grep '^INSTALLATION=' .env | head -1 | cut -d= -f2-)
if [ -z "$INSTALLATION" ]; then
  echo "ABBRUCH: In der .env fehlt INSTALLATION (z. B. INSTALLATION=eb)." >&2
  exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "1/6 Backup wird erstellt..."
if ! $COMPOSE exec -T backup /usr/local/bin/backup.sh; then
  echo "ABBRUCH: Das Backup ist fehlgeschlagen. Das Update wurde NICHT gestartet." >&2
  echo "Die laufende Version bleibt unverändert. Ursache oben in der Ausgabe prüfen." >&2
  exit 1
fi

echo "2/6 Neue Version wird geholt..."
git pull

echo "3/6 Neue Images werden gebaut..."
# Das bisherige App-Image vorher merken, damit man notfalls zurückwechseln kann.
ALTES_IMAGE=$($COMPOSE images -q app 2>/dev/null | head -1 || true)
if [ -n "$ALTES_IMAGE" ]; then
  docker tag "$ALTES_IMAGE" "${INSTALLATION}-app:vorher" || true
fi
$COMPOSE build

echo "4/6 Datenbank-Migrationen laufen..."
# Eigener Schritt: schlägt eine Migration fehl, läuft die alte App unverändert weiter.
if ! $COMPOSE run --rm migrate; then
  echo "ABBRUCH: Eine Datenbank-Migration ist fehlgeschlagen. Die App wurde NICHT neu gestartet." >&2
  echo "Die alte Version läuft weiter. Ursache oben in der Ausgabe prüfen." >&2
  exit 1
fi

echo "5/6 App wird neu gestartet..."
$COMPOSE up -d --no-deps app

echo "6/6 Health-Check..."
VERSUCH=0
while [ "$VERSUCH" -lt 15 ]; do
  # Gesund = HTTP 200 UND status "ok" UND Datenbank "ok" (sonst z. B. 503 bei Datenbankausfall).
  if $COMPOSE exec -T app node -e "
    fetch('http://localhost:3001/api/health')
      .then((r) => r.json().then((d) => process.exit(r.ok && d.status === 'ok' && d.datenbank === 'ok' ? 0 : 1)))
      .catch(() => process.exit(1));
  "; then
    echo "Update erfolgreich, Backend ist gesund."
    exit 0
  fi
  VERSUCH=$((VERSUCH + 1))
  sleep 2
done

echo "FEHLER: Backend antwortet nach dem Update nicht gesund. Abbruch." >&2
if [ -n "$ALTES_IMAGE" ]; then
  echo "Zum händischen Zurückwechseln auf die vorherige Version (siehe README, 'Update'):" >&2
  echo "  docker tag ${INSTALLATION}-app:vorher ${INSTALLATION}-prod-app" >&2
  echo "  $COMPOSE up -d --no-deps app" >&2
fi
exit 1
