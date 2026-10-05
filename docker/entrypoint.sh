#!/bin/sh
# Startet den App-Container: das gebaute Frontend in den von Caddy ausgelieferten
# Ordner kopieren, danach das Backend. Die Migrationen laufen vorher im Dienst
# "migrate" (docker-compose.prod.yml) mit dem Eigentümer-Zugang.
set -e

if [ -d /srv ]; then
  echo "Frontend-Dateien werden für Caddy bereitgestellt..."
  cp -r /app/frontend-dist/. /srv/
fi

echo "Backend startet..."
exec node /app/packages/core/fundament/backend/src/index.js
