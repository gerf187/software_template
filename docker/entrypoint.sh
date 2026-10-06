#!/bin/sh
# Startet den App-Container: das Backend, das auch das gebaute Frontend
# ausliefert (FRONTEND_ORDNER, siehe Dockerfile). Die Migrationen laufen vorher
# im Dienst "migrate" (docker-compose.prod.yml) mit dem Eigentümer-Zugang.
set -e

echo "Backend startet..."
exec node /app/packages/core/fundament/backend/src/index.js
