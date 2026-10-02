#!/bin/sh
# Update-Ablauf (Phase 3): Backup -> neue Version holen -> bauen -> starten
# (Migrationen laufen beim Start automatisch, siehe docker/entrypoint.sh) ->
# Health-Check. Bei Fehler: abbrechen und melden, nichts automatisch zurückdrehen.
set -eu

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "1/5 Backup wird erstellt..."
$COMPOSE exec -T backup /usr/local/bin/backup.sh

echo "2/5 Aktuelles Image wird als Sicherung markiert (app:vorher)..."
BISHERIGES_IMAGE=$($COMPOSE config --images app 2>/dev/null | head -1 || true)
if [ -n "$BISHERIGES_IMAGE" ]; then
  docker tag "$BISHERIGES_IMAGE" app:vorher 2>/dev/null || true
fi

echo "3/5 Neue Version wird geholt..."
git pull

echo "4/5 Neues Image wird gebaut und gestartet..."
$COMPOSE build app
$COMPOSE up -d app

echo "5/5 Health-Check..."
VERSUCH=0
while [ "$VERSUCH" -lt 15 ]; do
  if $COMPOSE exec -T app node -e "
    fetch('http://localhost:3001/api/health')
      .then((r) => r.json())
      .then((d) => process.exit(d.status === 'ok' ? 0 : 1))
      .catch(() => process.exit(1));
  "; then
    echo "Update erfolgreich, Backend ist gesund."
    exit 0
  fi
  VERSUCH=$((VERSUCH + 1))
  sleep 2
done

echo "FEHLER: Backend antwortet nach dem Update nicht gesund. Abbruch."
if [ -n "$BISHERIGES_IMAGE" ]; then
  echo "Zum händischen Zurückspielen der vorherigen Version:"
  echo "  docker tag app:vorher ${BISHERIGES_IMAGE}"
  echo "  ${COMPOSE} up -d app"
fi
exit 1
