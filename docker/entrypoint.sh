#!/bin/sh
# Startet den Produktivbetrieb: zuerst Migrationen (Abschnitt-Vorgabe
# "Migrationen laufen beim Start automatisch"), dann das gebaute Frontend
# in den von Caddy ausgelieferten Ordner kopieren, danach das Backend.
set -e

echo "Migrationen werden ausgeführt..."
node /app/packages/core/fundament/backend/src/db/migrate.js

if [ -d /srv ]; then
  echo "Frontend-Dateien werden für Caddy bereitgestellt..."
  cp -r /app/frontend-dist/. /srv/
fi

echo "Backend startet..."
exec node /app/packages/core/fundament/backend/src/index.js
