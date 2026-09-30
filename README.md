# SaaS-Grundgerüst

Baukasten für Branchen-Software (Projektmanagement). Alle Vorgaben stehen in `CLAUDE.md`.

## Erststart

```bash
cp .env.example .env                                            # einmalig: eigene Zugangsdaten
npm install
docker compose up -d                                          # startet PostgreSQL
npm run db:migrate --workspace packages/core/fundament/backend # legt die Datenbank-Tabellen an
npm run dev                                                    # startet Backend (Port 3001) und Frontend (Port 5173)
```

Danach:
- Frontend: http://localhost:5173
- Backend-Check: http://localhost:3001/api/health

## Zum Ausprobieren des Logins

```bash
npm run db:seed --workspace packages/core/fundament/backend
```

Legt eine Testfirma mit Login `admin@testfirma.de` / `Testpasswort-2026` an.
Login-Routen: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

## Tests

```bash
npm test --workspace packages/core/fundament/backend
```

Braucht eine laufende Datenbank (`docker compose up -d` + Migration).

## Beenden

```bash
docker compose down
```

## Ordnerstruktur

- `packages/core/fundament/` – Fundament (immer dabei): Frontend und Backend
- `packages/modules/` – Bausteine (Module), je ein Ordner
- `apps/energieberater/`, `apps/sachverstaendige/` – Branchen-Apps mit eigener Konfiguration
