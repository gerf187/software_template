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

Diese Anleitung bringt die App auf einen eigenen Server (VPS). Sie ist so
geschrieben, dass man sie ohne Server-Erfahrung Schritt für Schritt abarbeiten
kann. Jeder Befehl wird einzeln erklärt, danach steht, was zu sehen sein muss.

Jede Branche (Energieberater, Sachverständige, …) ist eine eigene Installation
mit eigenem Ordner, eigener Datenbank und eigener Domain. Mehrere Installationen
können auf demselben Server nebeneinander laufen.

**Was man vorher braucht**

- Einen Server mit Ubuntu, Docker und Docker Compose (beim Hosting-Anbieter
  vorhanden). Auf dem Server läuft bereits **Traefik** (Webserver mit
  HTTPS). Diese Anleitung nutzt ihn.
- Die Domain, z. B. `app.esser-energieberatung.de`, zeigt schon auf die IP
  des Servers.
- Zugang zum Server per SSH, z. B. `ssh root@<IP-des-Servers>`.
- Zugriff auf das GitHub-Repository (Konto mit Rechten am Repo).

Alle Befehle in diesem Abschnitt werden **auf dem Server** im Terminal
ausgeführt, nach dem Einloggen per SSH.

### Schritt 1: Deploy-Key anlegen (einmalig)

Ein Deploy-Key ist ein Schlüssel, mit dem der Server das Repository lesen
darf. Er gilt nur für dieses eine Repository und darf nur lesen.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_saas -N ""
```

Es erscheint eine Meldung mit „The key fingerprint…“. Danach den öffentlichen
Schlüssel anzeigen:

```bash
cat ~/.ssh/deploy_saas.pub
```

Es erscheint eine Zeile, die mit `ssh-ed25519` beginnt. Die ganze Zeile
kopieren. Dann auf GitHub:

1. Repository öffnen → **Settings** → **Deploy keys** → **Add deploy key**.
2. Titel: z. B. `Server eb`. Den kopierten Text ins Feld **Key** einfügen.
3. **Allow write access** bleibt **aus** (nur lesen).
4. **Add key** klicken.

Danach dem Server sagen, welchen Schlüssel er für GitHub benutzen soll:

```bash
cat >> ~/.ssh/config <<'EOT'
Host github-saas
    HostName github.com
    User git
    IdentityFile ~/.ssh/deploy_saas
    IdentitiesOnly yes
EOT
chmod 600 ~/.ssh/config
```

Test:

```bash
ssh -T git@github-saas
```

Erwartet: `Hi gerf187/software_template! You've successfully authenticated, but GitHub does not provide shell access.`
(Die Meldung „does not provide shell access“ ist richtig und kein Fehler.)

### Schritt 2: Repository holen

```bash
sudo mkdir -p /opt/projects
sudo chown $USER /opt/projects
git clone git@github-saas:gerf187/software_template.git /opt/projects/eb
cd /opt/projects/eb
```

`eb` ist der Ordnername für den Energieberater. Für die Sachverständigen wäre
es `/opt/projects/sv` (das Repository wird dafür noch einmal geklont).

Erwartet: `ls` zeigt unter anderem `docker-compose.prod.yml`, `scripts` und `README.md`.

### Schritt 3: `.env` ausfüllen

Die `.env` enthält alle Zugangsdaten. Sie wird nie ins Repository hochgeladen.

```bash
cp .env.example .env
openssl rand -hex 24     # einmal ausführen: ergibt ein sicheres Passwort, zweimal für die beiden Passwörter nötig
nano .env
```

Diese Werte eintragen (die anderen Zeilen so lassen):

| Zeile | Wert | Erklärung |
|---|---|---|
| `POSTGRES_PASSWORD=` | ein Passwort aus `openssl rand -hex 24` | Passwort der Datenbank (Eigentümer) |
| `APP_DB_PASSWORD=` | ein zweites Passwort aus `openssl rand -hex 24` | Passwort des laufenden Programms |
| `APP_NAME=` | `energieberater` | welche Branche. **Niemals `werkstatt`** |
| `INSTALLATION=` | `eb` | kurzer Name dieser Installation, nicht mehr ändern |
| `DOMAIN=` | `app.esser-energieberatung.de` | Adresse ohne `https://` |

**Wichtig:** Die Passwörter nur mit Buchstaben und Zahlen (`openssl rand -hex`).
Andere Zeichen wie `@`, `:` oder `/` stören die Verbindung zur Datenbank.

Speichern in `nano`: `Strg+O`, `Enter`, dann `Strg+X`.

Prüfen, dass die Werte drin stehen (ohne die Passwörter anzuzeigen):

```bash
grep -E '^(INSTALLATION|APP_NAME|DOMAIN)=' .env
```

Erwartet: die drei Zeilen mit `eb`, `energieberater` und der Domain.

### Schritt 4: Traefik prüfen

Die App hängt sich an das gemeinsame Netz `edge`, das Traefik nutzt.

```bash
docker network ls | grep edge
```

Erwartet: eine Zeile mit `edge`. Fehlt sie, ist Traefik auf dem Server nicht
gestartet. Dann zuerst Traefik starten (siehe Hosting-Anleitung), nicht weitermachen.

### Schritt 5: Starten

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Der erste Start dauert einige Minuten (Images werden gebaut und geladen).
Danach:

```bash
docker compose -f docker-compose.prod.yml ps
```

Erwartet:
- `postgres`, `app`, `backup`: **Up** (bei `postgres` steht zusätzlich „healthy“)
- `migrate`: **Exited (0)**. Das ist richtig: die Datenbank-Tabellen wurden angelegt und der Dienst ist fertig.

Prüfen, ob die App antwortet (eine Minute warten, bis das HTTPS-Zertifikat da ist):

```bash
curl https://app.esser-energieberatung.de/api/health
```

Erwartet: `{"status":"ok","datenbank":"ok"}`

Im Browser die Domain öffnen: Die Anmeldeseite erscheint, mit Schloss-Symbol für HTTPS.

Falls etwas nicht stimmt: `docker compose -f docker-compose.prod.yml logs -f app`
zeigt die Meldungen (mit `Strg+C` beenden).

### Schritt 6: Ersten Superadmin anlegen (einmalig)

Der Superadmin ist die Plattform-Rolle (Björn). Er legt Firmen an. Er wird
bewusst nicht über die Website angelegt, sondern mit einem Befehl:

```bash
docker compose -f docker-compose.prod.yml run --rm -it --entrypoint npm -w /app/packages/core/fundament/backend migrate run superadmin:anlegen
```

Der Befehl fragt nach **E-Mail-Adresse** und **Name**. Danach erscheint:

```
Superadmin angelegt.
E-Mail-Adresse: …
Startpasswort:  xxxx-xxxx-xxxx-xxxx
```

**Das Startpasswort wird nur einmal angezeigt.** Sofort notieren, z. B. im
Passwort-Manager. Ein zweiter Aufruf mit derselben E-Mail bricht mit einer
Meldung ab und ändert nichts.

### Schritt 7: Anmelden und Firma anlegen

1. Im Browser die Domain öffnen, mit E-Mail und Startpasswort anmelden.
2. Die Seite verlangt ein neues Passwort. Mindestens 12 Zeichen, keine Leerzeichen am Rand.
3. Im Menü **Firmen** öffnen → **Neue Firma**: Name und Kürzel (z. B. `esser`) eintragen → **Speichern**.
4. Bei der Firma die **Bausteine** prüfen (Häkchen setzen, was die Firma bekommt).
5. Unter **Firmen-Admin einladen**: Name und E-Mail des Firmen-Admins eintragen, dann **Einladen**.
   Danach erscheinen **E-Mail und Startpasswort** einmal. Beides an den Admin weitergeben.

Erwartet: Der Firmen-Admin kann sich anmelden und sieht die Firma.

### Update: neue Version einspielen

```bash
cd /opt/projects/eb
./scripts/update.sh
```

Das Skript macht der Reihe nach: **Backup** (muss gelingen) → neue Version holen
→ Images bauen → Datenbank-Migrationen → App neu starten → Gesundheitsprüfung.
Dabei gibt es eine kurze Unterbrechung der App.

Erwartet am Ende: `Update erfolgreich, Backend ist gesund.`

Bricht das Skript ab, läuft die **alte Version weiter**. Die Ausgabe nennt
die Ursache. Eine Migration, die fehlschlägt, startet die neue App nicht.

Falls die neue Version nach dem Update nicht gesund ist, zurück auf die alte
Version (die Ausgabe nennt die Befehle):

```bash
docker tag eb-app:vorher eb-prod-app
docker compose -f docker-compose.prod.yml up -d --no-deps app
```

### Backup und Wiederherstellung

Täglich um 3 Uhr nachts wird automatisch gesichert. Die Sicherungen liegen in
`/opt/projects/eb/backups/`, die letzten 14 Tage bleiben erhalten. Ist
`BACKUP_ZIEL` in der `.env` gesetzt, wird zusätzlich dorthin kopiert.

Prüfen, ob Sicherungen da sind:

```bash
ls -lh backups/
```

Erwartet: Dateien wie `datenbank_2026-10-07_03-00-00.sql.gz`. Die erste erscheint
nach dem ersten Lauf um 3 Uhr, oder sofort nach dem Befehl unten.

Eine Sicherung sofort auslösen:

```bash
docker compose -f docker-compose.prod.yml exec backup /usr/local/bin/backup.sh
```

Erwartet: `Backup geprüft und fertig`.

**Zurückspielen** (ersetzt den aktuellen Datenbank-Stand durch den Stand aus
der Sicherung, alle neueren Daten gehen verloren). Vorher die App anhalten:

```bash
docker compose -f docker-compose.prod.yml stop app
docker compose -f docker-compose.prod.yml exec -it backup /usr/local/bin/restore.sh datenbank_2026-10-07_03-00-00.sql.gz
```

Das Skript fragt nach. Nur **JA** in Großbuchstaben bestätigt. Danach die App
wieder starten:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps app
```

Erwartet: `Fertig.` in der Ausgabe, danach `curl https://…/api/health` zeigt `ok`.

Verschlüsselte Sicherungen (`.age`) brauchen den privaten Schlüssel. Er gehört
nicht auf den Server (z. B. im Passwort-Manager). Anleitung dazu im Abschnitt
„Verschlüsselte Backups“ weiter unten.

**Externe Sicherung:** Der Hosting-Anbieter sichert den ganzen Server täglich.
Ein eigener externer Speicherort (`BACKUP_ZIEL`) ist noch offen.

### Verschlüsselte Backups (optional)

Ist in der `.env` der öffentliche Schlüssel `BACKUP_VERSCHLUESSELUNG_SCHLUESSEL`
(beginnt mit `age1…`) eingetragen, endet jede neue Sicherung auf `.age`. Den
privaten Schlüssel nie auf dem Server lassen. Für eine Wiederherstellung die
Schlüsseldatei kurz nach `backups/` legen und beim Befehl angeben:

```bash
docker compose -f docker-compose.prod.yml exec -it -e BACKUP_ENTSCHLUESSELUNG_DATEI=/backups/schluessel.txt backup /usr/local/bin/restore.sh datenbank_….sql.gz.age
```

Danach die Datei `backups/schluessel.txt` wieder löschen.

### Stoppen und Starten

```bash
docker compose -f docker-compose.prod.yml down      # stoppt alles, Daten bleiben
docker compose -f docker-compose.prod.yml up -d     # wieder starten
```

**Nie `down -v` verwenden:** Das löscht die Datenbank.

### Zweite Installation auf demselben Server

Für eine weitere Branche (z. B. Sachverständige) das Repository in einen
eigenen Ordner klonen (`/opt/projects/sv`), dort eine eigene `.env` mit eigenem
`INSTALLATION=sv`, eigener `DOMAIN` und eigenen Passwörtern anlegen und wie
oben starten. Beide Installationen teilen nur das Netz `edge`. Datenbanken,
Container und Sicherungen sind getrennt.

### Server ohne Traefik (Alternative mit Caddy)

Nur nötig, wenn auf dem Server **kein** Traefik läuft. Dann übernimmt Caddy
das HTTPS. Ports 80 und 443 müssen frei sein.

```bash
# In der .env zusätzlich ACME_EMAIL=ihre@mail.de eintragen (für Zertifikats-Hinweise).
docker network create edge            # einmalig: leeres Netz, damit die Compose-Datei startet
docker compose -f docker-compose.prod.yml --profile caddy up -d --build
```

Ohne `--profile caddy` startet Caddy nicht. Bei Traefik bleibt es bei den
Befehlen oben.

### Speicher auf dem Server

Die Grenzen stehen in `docker-compose.prod.yml` (pro Installation etwa 1,3 GB
dauerhaft: Datenbank 768 MB, App 384 MB, Sicherung 192 MB). Damit kann z. B.
Ollama (KI-Chatbot) die Datenbank nicht verdrängen. Die Werte begründen sich im
Kommentar der Datei.

### Lokal testen (Entwicklungsrechner oder Codespace)

Den Produktions-Stack ohne Server prüfen. Die Testdomain ist `localhost`, es
gibt kein echtes Zertifikat (Traefik nimmt sein Standard-Zertifikat, daher
`curl -k`). Traefik mit denselben Einstellungen wie auf dem Server starten:

```bash
docker network create edge
mkdir -p /tmp/acme && touch /tmp/acme/acme.json && chmod 600 /tmp/acme/acme.json
docker run -d --name swt-traefik-test --network edge -p 8080:80 -p 8443:443 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro -v /tmp/acme:/letsencrypt \
  traefik:v3.6 \
  --providers.docker=true --providers.docker.exposedbydefault=false --providers.docker.network=edge \
  --entrypoints.web.address=:80 --entrypoints.websecure.address=:443 \
  --entrypoints.web.http.redirections.entrypoint.to=websecure --entrypoints.web.http.redirections.entrypoint.scheme=https \
  --certificatesresolvers.letsencrypt.acme.tlschallenge=true --certificatesresolvers.letsencrypt.acme.email=test@example.com \
  --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
INSTALLATION=swttest APP_NAME=energieberater DOMAIN=localhost \
  docker compose -f docker-compose.prod.yml up -d --build
curl -k https://localhost:8443/api/health       # erwartet: {"status":"ok","datenbank":"ok"}
```

Aufräumen (Stack, Volumes und Traefik entfernen, Dev-Datenbank bleibt):

```bash
INSTALLATION=swttest APP_NAME=energieberater DOMAIN=localhost \
  docker compose -f docker-compose.prod.yml down -v
docker rm -f swt-traefik-test
docker network rm edge
```

Hinweise:
- Traefik 3.5 oder älter meldet mit Docker 29 „client version 1.24 is too old“. Dann Traefik auf 3.6 oder neuer bringen. Dieselbe Prüfung gilt für den Server.
- Im Codespace blockiert die Firewall den Verkehr zwischen Containern in eigenen Netzen (`ETIMEDOUT`). Der Test klappt daher nur mit der Sonderregel aus dem Abschnitt „Codespace-Firewall“ unten. Auf einem normalen Server ist das nicht nötig.

**Codespace-Firewall:** Nur für lokale Tests. Freigabe für den Verkehr einer
Test-Bridge, z. B. `sudo iptables-legacy -I FORWARD 1 -i br-<id> -o br-<id> -j ACCEPT`
(`<id>` aus `docker network inspect edge`). Nach dem Test wieder entfernen
(`-D` statt `-I`).
