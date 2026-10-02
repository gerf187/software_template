# Produktions-Image (Phase 3, Abschnitt 3/4). Eine Installation pro Branche:
# APP_NAME entscheidet beim Bauen, welche App (energieberater, sachverstaendige)
# im Frontend eingebacken wird, und ist zugleich die Grundeinstellung für das
# Backend zur Laufzeit. Die Werkstatt lässt sich absichtlich nicht als
# Produktivbetrieb starten (siehe src/index.js).
#
# Ergebnis-Image enthält kein Entwicklungs-Werkzeug (kein vite, kein
# Dev-Server) -- nur das gebaute Frontend (von Caddy ausgeliefert) und das
# Backend mit seinen eigenen, schlanken Abhängigkeiten.

FROM node:22-alpine AS frontend-build
ARG APP_NAME=werkstatt
ENV VITE_APP=${APP_NAME}
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/fundament/frontend/package.json packages/core/fundament/frontend/package.json
# app.config.js importiert "@fundament/backend/..." (Abschnitt 5) -- auch
# dessen package.json muss schon da sein, damit npm den Workspace-Verweis
# anlegt, obwohl der Frontend-Build selbst kein Backend-Paket braucht.
COPY packages/core/fundament/backend/package.json packages/core/fundament/backend/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace packages/core/fundament/frontend

FROM node:22-alpine AS runtime
ARG APP_NAME=werkstatt
ENV NODE_ENV=production
ENV APP_NAME=${APP_NAME}
WORKDIR /app

# Nur die eigenen, schlanken Backend-Abhängigkeiten (bcrypt, cookie, express,
# pg) -- kein Workspace-weites npm install, damit keine Frontend-Pakete
# (react, vite, ...) ins Produktions-Image gelangen.
COPY packages/core/fundament/backend/package.json packages/core/fundament/backend/package.json
RUN npm install --prefix packages/core/fundament/backend --omit=dev

COPY packages/core/fundament/backend packages/core/fundament/backend
COPY apps apps
COPY packages/modules packages/modules

# app.config.js und einzelne Bausteine importieren "@fundament/backend/..."
# per npm-Paketname (Abschnitt 5) -- ohne echtes npm-Workspace-Install reicht
# ein einfacher Verweis im node_modules-Baum.
RUN mkdir -p node_modules/@fundament \
  && ln -s /app/packages/core/fundament/backend node_modules/@fundament/backend

COPY --from=frontend-build /app/packages/core/fundament/frontend/dist /app/frontend-dist

COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/app/entrypoint.sh"]
