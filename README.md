# SaaS-Grundgerüst

Baukasten für Branchen-Software (Projektmanagement). Alle Vorgaben stehen in `CLAUDE.md`.

## Erststart

```bash
npm install
docker compose up -d   # startet PostgreSQL
npm run dev             # startet Backend (Port 3001) und Frontend (Port 5173)
```

Danach:
- Frontend: http://localhost:5173
- Backend-Check: http://localhost:3001/api/health

## Beenden

```bash
docker compose down
```

## Ordnerstruktur

- `packages/core/fundament/` – Fundament (immer dabei): Frontend und Backend
- `packages/modules/` – Bausteine (Module), je ein Ordner
- `apps/energieberater/`, `apps/sachverstaendige/` – Branchen-Apps mit eigener Konfiguration
