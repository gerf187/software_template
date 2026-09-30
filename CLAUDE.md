# CLAUDE.md – SaaS-Grundgerüst

## 1. Worum es geht

Ein **Baukasten** für Branchen-Software (Projektmanagement):
- `apps/energieberater` – Energieberater
- `apps/sachverstaendige` – Sachverständige
- später ggf. Maler / Handwerker

Der Baukasten besteht aus dem **Fundament** (immer drin) und **Bausteinen** (Modulen),
die Björn pro Firma zuschaltet. Branchen-Apps enthalten **nur** Fachliches und ihre
Konfiguration.

Alle Design- und Technikvorgaben stehen in **Anhang A** am Ende dieser Datei.
Diese Datei ist die **einzige** Vorgabe – es gibt kein weiteres Dokument.

---

## 2. Arbeitsregeln – verbindlich

1. **Keine eigenständigen Änderungen.** Vor jedem Arbeitsschritt: kurzen Plan vorlegen
   (welche Dateien, was genau), auf Freigabe warten, dann umsetzen.
2. **Unklar = sofort melden.** Nicht raten, nicht drumherum arbeiten. Wenn eine Datei
   fehlt, etwas widersprüchlich ist oder ein Befehl fehlschlägt: klar sagen.
3. **Kurz und einfach antworten.** Deutsch, verständlich, ohne Fachchinesisch.
   Björn ist kein Entwickler.
4. **Kleine Schritte, kleine Commits.** Ein Commit = eine abgeschlossene Sache,
   aussagekräftige deutsche Commit-Nachricht.
5. **Keine Branchenbegriffe im Fundament oder in allgemeinen Bausteinen.** Begriffe wie
   „Antrag“, „Maßnahme“, „iSFP“, „BEG“, „Gutachten“ gehören in die jeweilige App.
6. **Nach jedem Schritt prüfen**, dass die App startet und nichts Bestehendes kaputt ist.
7. **Nichts löschen oder überschreiben**, ohne vorher zu fragen.
8. **Dateinamen ohne Leerzeichen und Umlaute.**
9. **Bausteine nur auf Bedarf bauen.** Der Baustein-Katalog (Abschnitt 13) ist eine
   Ideensammlung, kein Auftrag.
   Gebaut wird nur, was Björn ausdrücklich freigibt.

---

## 3. Feste Entscheidungen

| Thema | Entscheidung |
|---|---|
| Aufbau | Monorepo mit npm workspaces, Baukasten aus Fundament + Bausteinen |
| Betrieb | SaaS – Björn hostet alles auf seinem eigenen VPS |
| Installationen | Eine Installation pro Branche (z. B. `eb.<domain>`, `sv.<domain>`) |
| Mandanten | Mehrere Firmen pro Installation, **eine gemeinsame Datenbank**, streng getrennt über `firma_id` |
| Anpassung pro Kunde | Nur über Bausteine und Einstellungen – **kein** eigener Code pro Firma |
| Datenschutz | DSGVO: keine externen CDNs, Schriften/Icons selbst gehostet, Server in DE/EU |
| Mobil | Web, handytauglich – keine eigene App |

---

## 4. Technik

- **Frontend:** React + Vite, React Router
- **Backend:** Node.js + Express
- **Datenbank:** PostgreSQL (im Codespace und auf dem Server über Docker)
- **Login:** Session-Cookie (httpOnly), Token als SHA-256-Hash in `sessions`,
  7 Tage gleitend, Passwörter mit bcrypt (Cost 12) – Details in Anhang A.4
- **Icons:** Tabler Icons, lokal als React-Komponenten (kein npm-Paket, kein CDN), MIT-Lizenz mitliefern
- **Schriften:** Inter + Inter Tight, selbst gehostet (`/fonts/`), OFL-Lizenz mitliefern
- **Betrieb:** Docker Compose, Caddy als Webserver (automatisches HTTPS)

---

## 5. Ordnerstruktur (Ziel)

```
saas-grundgeruest/
  CLAUDE.md
  packages/
    core/
      fundament/           ← immer drin
        frontend/          ← Design-System, Komponenten, Layout, Login, Benutzer,
                             Rechte, Einstellungen, Superadmin, Kontakte, Suche
        backend/           ← Auth, Mandanten-Schutz, Rechte, Änderungsprotokoll,
                             Modul-Verwaltung, Basis-Routen, DB-Schema Fundament
      modules/             ← Bausteine, je ein Ordner
        projekte/
          modul.config.js
          frontend/
          backend/
          db/
        ablaufplaene/
        mitarbeiter/
        ...
  apps/
    energieberater/
      app.config.js
      modules/             ← nur EB-Fachbausteine (Anträge, Maßnahmen, …)
    sachverstaendige/
      app.config.js
      modules/
```

---

## 6. Mandanten-Trennung – sicherheitskritisch

Bild: Mehrfamilienhaus. Eine Installation, jede Firma ist eine Wohnung mit eigenem Schlüssel.

1. Tabelle `firmen` (id, name, slug, aktiv, erstellt_am, einstellungen JSONB).
2. **Jede** Fachtabelle hat `firma_id INT NOT NULL REFERENCES firmen(id)`.
3. `firma_id` kommt **immer aus der Session** des eingeloggten Nutzers –
   **nie** aus URL, Formular oder Request-Body.
4. Jede Datenbankabfrage filtert auf `firma_id`. Zentral über eine Hilfsfunktion,
   nicht in jeder Route einzeln von Hand.
5. Zweite Sicherheitsschicht: PostgreSQL **Row Level Security** auf allen Fachtabellen.
6. **Pflicht-Test:** Nutzer von Firma A darf Daten von Firma B weder sehen, ändern
   noch löschen – auch nicht über direkte API-Aufrufe mit fremder ID.
7. E-Mail-Adressen sind pro Firma eindeutig.

### Änderungsprotokoll (von Anfang an)

Tabelle `aenderungsprotokoll`: firma_id, user_id, zeitpunkt, tabelle, datensatz_id,
aktion (angelegt/geändert/gelöscht), alte_werte JSONB, neue_werte JSONB.
Jede Änderung an Fachdaten wird automatisch protokolliert – zentral, nicht pro Route,
auch für alle Bausteine. Anzeige im Tab „Verlauf“.

### DSGVO-Grundlagen (von Anfang an)

- **Soft-Delete:** Löschen setzt `deleted_at`, endgültiges Löschen nur über eigene Funktion.
- **Datenexport pro Kontakt:** alle Daten einer Person als Datei (Auskunftsrecht).

---

## 7. Rollen und Rechte

| Rolle | Ebene | Darf |
|---|---|---|
| **Superadmin** | Plattform (nur Björn) | Firmen anlegen/sperren, Firmen-Admins einladen, **Bausteine pro Firma freischalten**. Sieht **keine** Fachdaten der Firmen. |
| **Admin** | Firma | Alles in der eigenen Firma inkl. Benutzer, Einstellungen, Löschen |
| **Mitarbeiter** | Firma | Daten sehen und bearbeiten, nicht löschen, keine Benutzer/Einstellungen |
| **Betrachter** | Firma | Nur lesen – muss im Code tatsächlich durchgesetzt werden |

- **Rechte-Matrix statt fest verdrahteter Rollen:** Pro Rolle und Bereich festgelegt:
  sehen / bearbeiten / löschen. Jeder Baustein meldet seine Bereiche selbst an.
  Im Code wird nie `rolle === 'Admin'` geprüft, sondern immer das Recht,
  z. B. `darf('projekte', 'loeschen')`.
- Seite „Wer sieht was“ unter Einstellungen zeigt die Matrix als Tabelle (nur lesen in Phase 1).
- Rechte werden **im Backend** geprüft. Frontend blendet nur aus (Komfort, kein Schutz).
- Anzeigenamen der Rollen sind pro App konfigurierbar (z. B. „Berater“ statt „Mitarbeiter“).
- Benutzer haben Reiter „Aktiv“ / „Archiv“ statt Löschen.

---

## 8. Baukasten – Modul-System

### Fundament (immer drin, nicht abwählbar)
Login, Firmen, Benutzer, Rechte-Matrix, Einstellungen, Superadmin, Änderungsprotokoll,
DSGVO-Grundlagen, globale Suche, **Kontakte** (inkl. Notizen und freie Aufgaben am Kontakt).

### Regeln für jeden Baustein
1. Ein Baustein bringt alles selbst mit: Tabellen, Routen, Seiten, Menüpunkte,
   Rechte-Bereiche, Tabs für die Projekt-Akte, Suchquellen.
2. Beschreibung in `modul.config.js`: Name, Beschreibung, `braucht: [...]`
   (Abhängigkeiten), Menüpunkte, Rechte-Bereiche, Tabs.
3. Das Fundament lädt nur Bausteine, die für die Firma freigeschaltet sind.
   Nicht freigeschaltet = Menüpunkte, Seiten und API-Routen gibt es für diese Firma nicht.
4. **Ausschalten = ausblenden.** Daten bleiben erhalten und sind beim Wiedereinschalten da.
5. Bausteine greifen nie direkt in Tabellen anderer Bausteine, sondern über deren Funktionen.

### Zwei Ebenen der Auswahl
- **`app.config.js`** (pro Branche): welche Bausteine diese Software **anbietet**.
- **Superadmin-Seite „Bausteine“** (pro Firma): Björn setzt Häkchen, welche Bausteine
  die Firma **bekommt**. Fundament immer angehakt und gesperrt. Abhängigkeiten werden
  geprüft und angezeigt („Zeiterfassung braucht Projekte“). Nicht gebaute Bausteine
  erscheinen nicht. Tabelle `firma_module` (firma_id, modul, aktiv, seit).

### Weitere Einstellungen
**Pro App (`app.config.js`):** Produktname, Menügruppen, Projektstatus-Liste,
Projektarten, Phasen und Tabs der Projekt-Akte, Standard-Rechte-Matrix, Rollen-Anzeigenamen.

**Pro Firma (Seite „Einstellungen“, pflegt der Firmen-Admin):** Firmenname, Logo
(erscheint in der Sidebar), Akzentfarbe, Fristen.

---

## 9. Design-System

Grundlage: Anhang A.1–A.3 (Farben, Schriften, flaches Design ohne Schatten).
Verbesserungen gegenüber dem Original:

- **CSS-Variablen für alles:** Farben, Abstände, Radien, Schriftgrößen.
- **Abstandsraster 4 px:** `--space-1: 4px` … `--space-10: 40px`.
- **Radien:** `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-pill: 999px`.
- **Akzentfarbe als Variable**, per Firmen-Einstellung überschreibbar.
- **Statusfarben werden genutzt:** success, warn, danger, info (`--accent-2`), neutral.
  Nicht benötigte Variablen entfernen.
- **Fokus sichtbar:** `:focus-visible` für alle Bedienelemente.
- Keine doppelten Klassen – eine Komponente, überall genutzt.
- **Handytauglich von Anfang an:** Sidebar wird auf schmalen Bildschirmen zum
  Aufklapp-Menü, Tabellen werden auf dem Handy zu Karten, Bedienelemente mindestens
  44 px hoch. Jede Seite auch in 375 px Breite prüfen.

---

## 10. Komponenten (im Fundament)

Echte React-Komponenten, nicht nur CSS-Klassen:

Button (primär, sekundär, gefahr, deaktiviert, lädt) · Eingabefeld · Textfeld ·
Auswahl · Checkbox · Formularfeld mit Label + Fehlertext · Karte · Tabelle
(mit Spaltenköpfen, sortierbar, Leerzustand) · Status-Badge · Dialog
(ersetzt `confirm()`) · Tabs · Meldung (Erfolg/Fehler/Hinweis) · Ladeanzeige ·
Leerzustand · Seitenkopf (Titel + Aktionen) · **Phasen-Leiste** · **Akte**
(Seitenkopf + Phasen-Leiste + Tabs, Tabs aus Konfiguration) · **Fristbalken**
(Balken füllt sich grün → rot bis zum Fristende)

Jede Komponente einmal auf einer internen Musterseite `/muster` zeigen
(nur für Superadmin sichtbar).

---

## 11. Kontakte und Projekt-Akte

**Kontakte (Fundament):**
- Kontakt ist der **Startpunkt**. Angebote hängen später am Kontakt,
  ein Projekt entsteht erst bei Auftrag.
- Wohnadresse und Objektadresse getrennt.
- Feld „Empfohlen von“ (Verweis auf anderen Kontakt oder Freitext, z. B. „Google“).
- Notizen und freie Aufgaben (Freitext + Fälligkeit) direkt am Kontakt.

**Projekt-Akte (Baustein „Projekte“):** Eine Seite pro Projekt, auf der alles liegt.
Oben Phasen-Leiste (z. B. Anfrage → Angebot → Beauftragt → In Arbeit → Abgeschlossen),
darunter Tabs. Der Baustein liefert den Rahmen, App und andere Bausteine liefern Tabs.
Tabs in Phase 1: Übersicht, Kontakt, Notizen, Aufgaben, Verlauf.

---

## 12. Phasen

Jede Phase endet mit einer kurzen Zusammenfassung für Björn und wartet auf Freigabe.

**Phase 0 – Grundstruktur**
Monorepo mit Ordnern wie in Abschnitt 5, Workspaces, Frontend + Backend starten,
PostgreSQL im Codespace über Docker, Schriften + Icons einmalig holen (mit Lizenzen),
`README.md` mit Startanleitung.
✔ Fertig, wenn: `npm run dev` startet eine leere App mit Sidebar-Layout.

**Phase 1 – Fundament + Baustein „Projekte“**
Reihenfolge: Design-System → Komponenten → Layout/Sidebar → Datenbank-Schema Fundament
(firmen, firma_module, users, sessions, rechte, aenderungsprotokoll, contacts, notes, tasks)
→ Login → Mandanten-Schutz inkl. Tests → Modul-System inkl. Superadmin-Seite „Bausteine“
→ Rechte-Matrix → Änderungsprotokoll → Benutzer → Einstellungen → Kontakte → Suche
→ **erster Baustein „Projekte“** mit Projekt-Akte (beweist, dass das Modul-System funktioniert).

Fundament für Ablaufpläne mitdenken: Tabelle `tasks` mit firma_id, contact_id,
project_id, zustaendig_id, faellig_am, status, step_key (gesetzt = aus Ablaufplan,
leer = manuell). Noch keine Engine.
✔ Fertig, wenn: zwei Testfirmen existieren, getrennt arbeiten, der Trennungstest grün ist
und „Projekte“ sich pro Firma ein- und ausschalten lässt.

**Phase 2 – Baustein „Ablaufpläne“ (Tagesaufgaben)**
Nach „Prinzip C“ (Anhang A.5):
Abläufe als Daten, harte/weiche Voraussetzungen, Status „entfällt“ vs. „ausgeblendet“,
Pausieren mit Grund, Eskalationsketten, Fristen pro Firma, Tagesaufgaben-Ansicht.
Vorher eigener Plan mit Freigabe.
✔ Fertig, wenn: ein Projekt aus einer Vorlage seine Aufgaben erzeugt und die
Tagesaufgaben nur freigegebene Aufgaben zeigen.

**Phase 3 – Betrieb**
Dockerfile, Docker Compose (App, PostgreSQL, Caddy), tägliches Datenbank-Backup
nach extern, Update-Anleitung mit Backup vorher, einfache Überwachung.
✔ Fertig, wenn: Björn mit einer Anleitung die App auf dem VPS starten und aktualisieren kann.

**Phase 4 – Energieberater umziehen**
Fachliches aus der bestehenden EB-Software als EB-Bausteine auf das Fundament setzen.

**Phase 5 – Sachverständige starten**

---

## 13. Baustein-Katalog – Ideen, NICHT bauen ohne Freigabe

⭐ = für fast jede Firma sinnvoll (Standardpaket).

| Bereich | Bausteine |
|---|---|
| Kunden & Vertrieb | ⭐ Anfrage-Eingang · ⭐ Angebote (am Kontakt, Angebots-Link mit digitaler Annahme) · Kundenportal · Online-Terminbuchung · Google-Bewertungsanfrage nach Abschluss · Automatische Kundenerinnerungen |
| Auftrag | ⭐ Projekte + Akte · Ablaufpläne · ⭐ Termine/Kalender (ICS, Outlook/Google) · ⭐ Wiedervorlagen · Fristen + Fristbalken · Objekte/Gebäude projektübergreifend · Vor-Ort-Protokoll mit Fotos + Unterschrift · Plausibilitätsprüfung von Daten |
| Dokumente | ⭐ Dokumentenablage · ⭐ Dokumente aus Vorlagen erzeugen · Upload-Routing (automatisch zuordnen) · E-Signatur |
| Geld | ⭐ Rechnungen + E-Rechnung (XRechnung/ZUGFeRD) · Mahnwesen · DATEV-Export · Stundensatz-Auswertung |
| Mitarbeiter | Mitarbeiter (Stammdaten, Qualifikationen; Mitarbeiter ≠ Benutzer) · Abwesenheit (Urlaubskalender, Antrag + Freigabe, Krank, Resturlaub) · Zeiterfassung (Stempeluhr am Handy, Buchung auf Projekte; braucht Projekte; Korrekturen nur mit Protokoll) · Team-Board · Geräte/Fahrzeuge · Schulungsnachweise |
| Kommunikation | ⭐ E-Mails in die Akte · E-Mail-Versand mit Textvorlagen (EU-Dienst) · Benachrichtigungen |
| KI | RAG-Wissensdatenbank · Dokumente auslesen · Textentwürfe · Sprachnotiz → Protokoll |
| Marketing | Social Media · Website-Anbindung |
| Auswertung | ⭐ Dashboard „Braucht Aufmerksamkeit“ · Reporting/Monatsberichte |
| Sonstiges | 2-Faktor-Login · Passwort vergessen · PLZ-Ort-Automatik · In-App-Hilfebutton · Datenschutz-Seite mit Löschkonzept |

**Nicht bauen:** WhatsApp-Anbindung (Datenschutz), Bonus-/Provisionssysteme,
Kanban-Board, freier Workflow-Editor, eigene Handy-App.

---

## Anhang A – Design- und Technikvorgaben

Übernommen aus der bestehenden Energieberater-Software. Nur das, was das Grundgerüst
braucht. Branchenbegriffe sind entfernt.

### A.1 Farben (CSS-Variablen, 1:1 übernehmen)

```css
:root {
  --bg: #f6f8f6;
  --bg-card: #ffffff;
  --bg-sidebar: #ffffff;
  --bg-sidebar-hover: #eaf4ee;
  --bg-sidebar-active: #2f7d5c;   /* = Akzent, per Firma überschreibbar */
  --ink: #1c2b24;                 /* Haupttext, Primär-Button */
  --ink-hover: #2c3f36;           /* Primär-Button Hover */
  --ink-soft: #4d5f57;
  --ink-mute: #8b968f;
  --line: #e3e8e3;
  --line-soft: #edf1ec;
  --accent: #2f7d5c;              /* per Firma überschreibbar */
  --accent-soft: #e2f0e6;
  --info: #3f8fc4;       --info-bg: #dcedf7;
  --warn: #c9742d;       --warn-bg: #fdf2e4;
  --danger: #b8443a;     --danger-bg: #fde6e3;
  --success: #2f7d5c;    --success-bg: #e2f0e6;
  --gold: #b8893e;       --gold-bg: #f8eed8;
}
```

Statusfarben für Badges und Fristbalken: success (grün), warn (orange),
danger (rot), info (blau), neutral (`--ink-mute` auf `--line-soft`).
Keine Schatten (`box-shadow`) – Abgrenzung nur über `1px solid var(--line)`.

### A.2 Schriften

| Schrift | Datei | Verwendung |
|---|---|---|
| Inter Tight 400–700 (variabel) | `InterTight-Variable.woff2` | Fließtext, Formulare, Tabellen (`body`) |
| Inter 400–700 (variabel) | `Inter-Variable.woff2` | Überschriften h1–h3, `font-weight: 600` |
| Inter Italic 400–700 | `Inter-Italic-Variable.woff2` | Betontes Wort in Titeln/Marke |

Eingebunden per `@font-face` mit `font-display: swap` aus `/fonts/`. Keine weiteren Schnitte.

**Markenstil:** Zweiter Namensteil kursiv in Akzentfarbe, z. B. „Esser *Energieberatung*“:
`em { font-style: italic; font-weight: 400; color: var(--accent); }`.
Gleiches Muster in Seitentiteln: `<h1>Alle <em>Kontakte</em></h1>`.

### A.3 Maße und Bausteine der Oberfläche

**Grundwerte:** Body 14px, `line-height: 1.5`. Hauptbereich-Padding 32px 40px.

| Element | Werte |
|---|---|
| Layout | Grid: Sidebar 240px + Rest. Sidebar `position: sticky; height: 100vh`, weiß, rechte Linie `--line` |
| Sidebar Marke | 22px, Inter 600, `letter-spacing: -0.02em`; Unterzeile 11px, uppercase, `letter-spacing: 0.12em`, `--ink-mute`. Später: Firmenlogo statt Text |
| Sidebar Gruppen-Label | 10px, uppercase, `letter-spacing: 0.14em`, `--ink-mute`, 500 |
| Sidebar Menüpunkt | 13.5px, `padding: 9px 12px`, Radius 6px, `--ink-soft`, Icon 17px mit `opacity: 0.75`. Hover: `--bg-sidebar-hover`, Text `--ink`. Aktiv: Hintergrund `--bg-sidebar-active`, Text weiß, 500 |
| Sidebar unten | Name (13px, 500) + Rolle (11.5px, `--ink-mute`), darunter Button „Abmelden“ (Rahmen `--line`, Radius 6px, 12.5px) |
| Seitenkopf | Flex, unten ausgerichtet, `margin-bottom: 32px`, `padding-bottom: 20px`, Linie `--line`. h1 34px, Inter 600, `letter-spacing: -0.02em`, `line-height: 1.05`. Meta rechts 13px, `--ink-mute`, `tabular-nums` |
| Karte | weiß, Radius 12px, `padding: 22px 24px`, Rahmen `--line`. Kopf mit Linie `--line-soft`, Titel 18px Inter 600 |
| Primär-Button | Hintergrund `--ink`, weiß, `padding: 9px 16px`, Radius 8px, 13px, 500. Hover `--ink-hover`. Deaktiviert `opacity: 0.6` |
| Text-Button | ohne Hintergrund; „Abbrechen“ in `--ink-mute`, „Löschen“ in `--danger` |
| Eingabefeld | weiß, Rahmen `--line`, Radius 8px, `padding: 9px 12px`, 13.5px. Fokus: Rahmen `--accent`. Auswahllisten gleiche Optik |
| Label | 12px, 500, `--ink-soft`, Abstand 6px |
| Tabelle | Zellen `padding: 12px 0`, Linie `--line-soft`, letzte Zeile ohne Linie. **Neu:** Spaltenköpfe |
| Badge | `--accent-soft` / `--accent`, 10px uppercase, Radius 4px; Pille Radius 999px |
| Meldung | Fehler `--danger-bg`/`--danger`, Erfolg `--success-bg`/`--success`, Radius 8px, `padding: 10px 12px`, 12.5px, im Formular über dem Button |
| Leerzustand | zentriert, 13px, kursiv, `--ink-mute`, z. B. „Keine Kontakte gefunden.“ |
| Ladezustand | Button-Text „Speichern …“ und deaktiviert. **Neu:** Ladeanzeige-Komponente |
| Login | Mittig auf `--bg`, Karte 340px, `padding: 40px 36px`, Marke + Unterzeile, Felder „E-Mail“ und „Passwort“, Button volle Breite „Anmelden“ / „Anmelden …“ |

**Icons:** Tabler Icons als eigene kleine React-Komponenten, `width/height 17`,
`viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth 2`, kein Fill.

**Entwicklung:** Vite leitet `/api` an das Backend weiter (Proxy auf `http://localhost:3001`),
dadurch kein CORS nötig.

### A.4 Login und Sicherheit

- Tabelle `sessions`: id (SHA-256-Hash des Tokens), user_id, created_at, expires_at,
  last_used_at, ip_adresse, user_agent. Session 7 Tage, bei jeder Nutzung verlängert.
- Cookie httpOnly, `secure` in Produktion, `sameSite: lax`.
- Passwort: bcrypt Cost 12, mindestens 12 Zeichen, keine trivialen Passwörter,
  nicht gleich der E-Mail.
- Login-Sperre: 5 Fehlversuche → 15 Minuten gesperrt pro E-Mail.
  **In der Datenbank speichern**, nicht nur im Arbeitsspeicher (übersteht sonst keinen Neustart).
- Fehlermeldung beim Login immer gleich: „E-Mail oder Passwort falsch.“
  (nicht verraten, ob die E-Mail existiert).
- Inaktive Benutzer können sich nicht anmelden.
- Login, Fehlversuch, Benutzer angelegt → ins Protokoll.
- Keine Berechtigung → HTTP 403 „Keine Berechtigung.“
- Routen: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
  `GET /api/health` (Datenbank-Check).

### A.5 Regeln für Ablaufpläne („Prinzip C“) – für Phase 2

- Zwei Ebenen: Aufgaben auf **Projektebene** und auf **Unterebene** (die App legt fest,
  was die Unterebene ist, z. B. „Antrag“ beim Energieberater).
- Jede Aufgabe hat eine Liste „braucht“ mit Voraussetzungen, jeweils **hart** oder **weich**.
- **Gesperrt** = mindestens eine harte Voraussetzung ist nicht erledigt/entfällt.
  Gesperrte Aufgaben zeigen eine Begründung.
- **Sichtbar in Tagesaufgaben** = keine Voraussetzung mehr offen, weder hart noch weich.
- Weiche Voraussetzung sperrt nie, zeigt nur einen gelben Hinweis.
- Zwei getrennte Status: **entfällt** (nur automatisch durch eine Auswahl, gibt harte
  Sperren frei) und **ausgeblendet** (manuell, gibt harte Sperren **nicht** frei).
- Aufgaben-Typen: `aktion` · `warten` · `termin` (fragt Datum, Folgeaufgaben erscheinen
  an diesem Tag) · `auswahl` (die Option bestimmt, welcher Zweig entfällt).
- Eskalationsketten, z. B. Mail → Anruf → Pausiert; Zahlung endet in „Mahnwesen“.
- Pausieren nur mit Grund, Wiedervorlage alle 28 Tage. Unterscheiden:
  „Pausiert (manuell)“ und „Pausiert (Eskalation)“.
- **Alle Fristen** stehen in den Firmen-Einstellungen, **nie** in der Ablaufvorlage.
  Fallback: Systemvorgabe.
- Abläufe sind reine Daten: neue Abläufe ohne Codeänderung. Firmen können eine Vorlage
  kopieren und anpassen (mit Versionsnummer). Ein Projekt funktioniert auch ohne Vorlage.
- Aufgaben pro Projekt ausblendbar, freie Zusatzaufgaben jederzeit möglich,
  manuelle Sortierung nur zur Anzeige.
- Nur eine Aufgaben-Tabelle `tasks`: `step_key` gesetzt = aus Vorlage, leer = manuell.
