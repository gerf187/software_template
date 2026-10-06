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

Die Test-Logins kommen mit der Werkstatt-Demo, siehe Abschnitt unten
(`npm run db:seed:werkstatt`). Login-Routen: `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/me`.

## Werkstatt (Björns Testumgebung)

```bash
npm run db:seed:werkstatt --workspace packages/core/fundament/backend
npm run dev
```

Setzt die Werkstatt-Demo-Daten immer frisch zurück (auch mehrfach ausführbar):
zwei Demo-Firmen, 5 Test-Konten, Passwort überall `Werkstatt-Test-2026`.

| E-Mail | Rolle | Firma |
|---|---|---|
| `admin-a@werkstatt.test` | Admin | Demo Firma A |
| `user-a@werkstatt.test` | User | Demo Firma A |
| `admin-b@werkstatt.test` | Admin | Demo Firma B |
| `superadmin@werkstatt.test` | Superadmin | keine |

Oben auf jeder Seite: gelber „Testumgebung"-Balken mit einem Rollen-Umschalter
(mit einem Klick als anderer Test-Nutzer anmelden). Der Umschalter existiert
nur in der Werkstatt und nie im Produktivbetrieb.

## Tests

```bash
npm test --workspace packages/core/fundament/backend
```

Die Tests laufen auf einer eigenen Datenbank `saas_test` (wird beim Start angelegt
und migriert). Die Werkstatt-Datenbank bleibt unberührt.

Frontend-Tests (Farbe aus dem Logo, Kontrast):

```bash
npm test --workspace packages/core/fundament/frontend
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

## Betrieb (echter Server, Phase 3)

Diese Anleitung ist für den Betrieb auf einem eigenen Server (VPS) gedacht,
Schritt für Schritt, auch ohne Server-Erfahrung. Jede Branche (Energieberater,
Sachverständige, …) läuft als eigene, komplett getrennte Installation mit
eigener Datenbank und eigenem Server-Verzeichnis.

### Server vorbereiten (einmalig)

1. Einen Server mit Docker und Docker Compose besorgen (z. B. ein VPS mit
   Ubuntu, Docker per `curl -fsSL https://get.docker.com | sh` installieren).
2. Eine Domain auf die IP des Servers zeigen lassen (A-Record), z. B.
   `eb.deine-domain.de` für den Energieberater.
3. Dieses Repository auf den Server holen (z. B. `git clone ...`) und in den
   Ordner wechseln.
4. `.env` anlegen: `cp .env.example .env`, dann öffnen und ausfüllen:
   - `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`: eigene, sichere Passwörter.
   - `APP_NAME`: welche Branche hier läuft, z. B. `energieberater`.
     **Niemals `werkstatt`** – das ist Björns Testumgebung und startet im
     Produktivbetrieb absichtlich nicht.
   - `DOMAIN`: die Domain aus Schritt 2, z. B. `eb.deine-domain.de`.
   - `ACME_EMAIL`: eine E-Mail-Adresse für Zertifikats-Hinweise.
   - `BACKUP_ZIEL`: optional, ein zusätzlicher Ort für Backups außerhalb
     dieses Servers (z. B. ein per `rclone`/`sshfs` eingebundener Ordner).
     Leer lassen, wenn Backups vorerst nur lokal liegen sollen.

### Starten

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Das baut das Produktions-Image (einmalig etwas langsamer) und startet die
Container: `migrate` (baut beim Start die Datenbank-Tabellen auf und beendet
sich danach), `app` (Backend), `postgres` (Datenbank), `caddy` (Webserver,
holt automatisch ein HTTPS-Zertifikat für die Domain) und `backup`
(tägliche Sicherung, nachts um 3 Uhr). Nur `migrate` kennt den Eigentümer-
Zugang zur Datenbank; die `app` nutzt nur ihren eingeschränkten Zugang.

Prüfen, ob alles läuft:

```bash
docker compose -f docker-compose.prod.yml ps
curl https://deine-domain.de/api/health   # sollte {"status":"ok","datenbank":"ok"} zeigen
```

Logs ansehen, falls etwas nicht passt: `docker compose -f docker-compose.prod.yml logs -f app`.

### Ersten Superadmin anlegen (einmalig)

Der Superadmin ist die Plattform-Rolle (Björn), die Firmen anlegt und sperrt.
Er wird nicht über die Web-Oberfläche angelegt, sondern mit einem Befehl im
Server-Terminal:

```bash
docker compose -f docker-compose.prod.yml run --rm -it --entrypoint npm -w /app/packages/core/fundament/backend migrate run superadmin:anlegen
```

Der Befehl fragt nach E-Mail-Adresse und Name und zeigt danach ein
Startpasswort **genau einmal** an. Bitte sofort notieren. Beim ersten Login
muss es geändert werden. Ein zweiter Aufruf mit derselben E-Mail-Adresse
bricht mit einer Meldung ab, ohne etwas zu ändern.

### Aktualisieren (neue Version einspielen)

```bash
./scripts/update.sh
```

Macht in dieser Reihenfolge: Backup → neue Version holen (`git pull`) → neues
Image bauen und starten (Datenbank-Tabellen werden dabei automatisch
aktualisiert) → prüfen, ob das Backend wieder gesund ist. Bricht bei einem
Fehler ab und meldet das, ohne die laufende (alte) Version zu beenden; das
vorherige Image bleibt zusätzlich unter `app:vorher` erhalten, falls von Hand
zurückgewechselt werden muss.

### Backup und Wiederherstellung

Täglich um 3 Uhr automatisch, liegt im Ordner `./backups/` (14 Tage
aufbewahrt, ältere werden automatisch gelöscht) und zusätzlich extern, wenn
`BACKUP_ZIEL` gesetzt ist.

Von Hand ein Backup auslösen:

```bash
docker compose -f docker-compose.prod.yml exec backup /usr/local/bin/backup.sh
```

Ein Backup zurückspielen (z. B. nach einem Datenverlust) – **löscht den
aktuellen Stand der Datenbank und ersetzt ihn durch den Stand aus dem
Backup**, fragt vorher extra nach:

```bash
docker compose -f docker-compose.prod.yml exec -it backup /usr/local/bin/restore.sh <dateiname>
```

`<dateiname>` ist der Name der Datei aus `./backups/` (z. B.
`datenbank_2026-10-02_03-00-00.sql.gz`), ohne Pfad davor.

**Verschlüsselte Backups (optional):** Ist in `.env` der öffentliche Schlüssel
`BACKUP_VERSCHLUESSELUNG_SCHLUESSEL` (beginnt mit `age1…`) eingetragen, endet
jede neue Sicherung auf `.age` und ist ohne den privaten Schlüssel nicht
lesbar. Den privaten Schlüssel **nicht** auf dem Server aufbewahren, sondern
z. B. im Passwort-Manager. Für eine Wiederherstellung die Schlüsseldatei
kurz in den Ordner `./backups/` legen, `BACKUP_ENTSCHLUESSELUNG_DATEI=/backups/<schluesseldatei>`
setzen (z. B. `docker compose ... exec -e BACKUP_ENTSCHLUESSELUNG_DATEI=/backups/schluessel.txt -it backup /usr/local/bin/restore.sh <dateiname>`)
und danach wieder löschen.

### Beenden

```bash
docker compose -f docker-compose.prod.yml down
```

Die Daten (Datenbank, Backups, HTTPS-Zertifikate) bleiben erhalten und sind
nach einem erneuten `up -d` wieder da.

### Lokal testen, bevor es auf den echten Server geht

Der komplette Stack lässt sich auch auf dem eigenen Rechner/Codespace
ausprobieren. Weil dort meist schon die normale Entwicklungsumgebung
(`docker compose up -d`) läuft, einen eigenen Projektnamen mitgeben, damit
sich beides nicht in die Quere kommt:

```bash
APP_NAME=energieberater docker compose -p swt_test -f docker-compose.prod.yml up -d --build
curl -k https://localhost/api/health   # -k: Caddys selbstsigniertes Lokal-Zertifikat für "localhost"
APP_NAME=energieberater docker compose -p swt_test -f docker-compose.prod.yml down -v   # zum Aufräumen
```

(Mit einer echten `DOMAIN` holt Caddy stattdessen automatisch ein echtes,
vertrauenswürdiges Zertifikat – dann ist `-k` nicht nötig.)
