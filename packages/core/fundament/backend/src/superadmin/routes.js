import { Router } from "express";
import { erzeugeStartpasswort } from "../auth/startpasswort.js";
import { requireAuth, requireSuperadmin } from "../auth/middleware.js";
import { pool } from "../db/pool.js";
import { withFirma } from "../db/withFirma.js";
import { hashPassword, pruefePasswort } from "../auth/password.js";
import { rechteStandardAnlegen, rechteFuerBausteinAnlegen } from "../rechte/standardAnlegen.js";
import { fehlendeAbhaengigkeiten } from "../module/abhaengigkeiten.js";
import { pruefePlz } from "../validierung/plz.js";
import { pruefeUstIdNr } from "../validierung/ustIdNr.js";
import appConfig from "../appConfig.js";
import { ladeModule } from "../module/lade.js";
import { pruefeIdsAusUrl } from "../db/ids.js";
import { erzeugeSlugAusName } from "./slug.js";

const router = Router();
pruefeIdsAusUrl(router, ["id"]);
router.use(requireAuth, requireSuperadmin);

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIRMA_SPALTEN = `
  id, kundennummer, name, slug, aktiv, erstellt_am,
  strasse, plz, ort, ansprechpartner, rechnungs_email, telefon, ust_id_nr, notiz
`;

// Firmen anlegen/sperren (Abschnitt 7). "firmen" hat kein RLS -- wird nur
// über diese Superadmin-Routen verwaltet (siehe Migration 0001). "firma_module"
// hat aber RLS wie jede Fachtabelle (Abschnitt 6) -- ein einfacher JOIN ohne
// gesetzte firma_id liefert deshalb für jede Firma null Zeilen zurück (Bug,
// Teil A). Die Namen der aktiven Bausteine kommen daher Firma für Firma über
// withFirma(), genau wie es die Baustein-Seite einer einzelnen Firma schon
// richtig macht (Abschnitt 6, Regel 4: zentrale Hilfsfunktion statt Handarbeit
// pro Route).
router.get("/firmen", async (req, res) => {
  const { rows } = await pool.query(`SELECT ${FIRMA_SPALTEN} FROM firmen ORDER BY name`);
  const module = await ladeModule();
  const titelNachModul = Object.fromEntries(module.map((m) => [m.name, m.config.titel || m.name]));
  const katalogReihenfolge = Object.fromEntries(module.map((m, i) => [m.name, i]));

  const firmen = await Promise.all(
    rows.map(async (firma) => {
      const aktive = await withFirma(firma.id, (client) =>
        client
          .query("SELECT modul FROM firma_module WHERE firma_id = $1 AND aktiv = true", [firma.id])
          .then((r) => r.rows)
      );
      const bausteine = aktive
        .map((r) => r.modul)
        .filter((modul) => titelNachModul[modul] !== undefined)
        .sort((a, b) => katalogReihenfolge[a] - katalogReihenfolge[b])
        .map((modul) => titelNachModul[modul]);
      return { ...firma, bausteine };
    })
  );
  res.json(firmen);
});

// Kürzel (Slug) kommt nicht aus dem Formular, sondern wird aus dem Namen
// erzeugt (Abschnitt 7). Bei Doppelung hängt eine Zahl an -- die Schleife
// verlässt sich auf die UNIQUE-Regel der Datenbank (Migration 0001), damit
// zwei gleichzeitige Anlagen nie denselben Slug bekommen.
//
// Alles in einer Transaktion (Teil B, Björns Vorgabe): Kundendaten, gewählte
// Bausteine (inkl. deren Rechte-Bereiche) und optional der erste Admin
// entstehen zusammen -- schlägt ein Teil fehl, wird nichts angelegt.
router.post("/firmen", async (req, res) => {
  const body = req.body || {};
  const name = (body.name || "").trim();
  const strasse = (body.strasse || "").trim();
  const plz = String(body.plz ?? "").trim();
  const ort = (body.ort || "").trim();
  const ansprechpartner = (body.ansprechpartner || "").trim();
  const rechnungsEmail = (body.rechnungsEmail || "").trim();
  const telefon = body.telefon || null;
  const ustIdNr = body.ustIdNr || null;
  const notiz = body.notiz || null;
  const moduleNamen = Array.isArray(body.module) ? body.module : [];
  const admin = body.admin?.email && body.admin?.name ? body.admin : null;

  if (!name) return res.status(400).json({ error: "Bitte Name angeben." });
  if (!strasse) return res.status(400).json({ error: "Bitte Straße angeben." });
  const plzFehler = pruefePlz(plz);
  if (!plz || plzFehler) return res.status(400).json({ error: plzFehler || "Bitte PLZ angeben." });
  if (!ort) return res.status(400).json({ error: "Bitte Ort angeben." });
  if (!ansprechpartner) return res.status(400).json({ error: "Bitte Ansprechpartner angeben." });
  if (!EMAIL_MUSTER.test(rechnungsEmail)) {
    return res.status(400).json({ error: "Bitte eine gültige Rechnungs-E-Mail angeben." });
  }
  const ustIdNrFehler = pruefeUstIdNr(ustIdNr);
  if (ustIdNrFehler) return res.status(400).json({ error: ustIdNrFehler });

  const basisSlug = erzeugeSlugAusName(name);
  if (!basisSlug) {
    return res.status(400).json({ error: "Aus diesem Namen kann kein Kürzel erzeugt werden." });
  }

  // Bausteine + Abhängigkeiten innerhalb der gewählten Menge prüfen, bevor
  // überhaupt etwas angelegt wird (Abschnitt 8: "Zeiterfassung braucht Projekte").
  const alleModule = await ladeModule();
  const gewaehlt = new Set(moduleNamen);
  for (const modulName of gewaehlt) {
    const eintrag = alleModule.find((m) => m.name === modulName);
    if (!eintrag) return res.status(400).json({ error: `Baustein "${modulName}" nicht gefunden.` });
    const fehlend = fehlendeAbhaengigkeiten(eintrag.config.braucht, gewaehlt);
    if (fehlend.length > 0) {
      return res
        .status(400)
        .json({ error: `Baustein "${eintrag.config.titel || modulName}" braucht zuerst: ${fehlend.join(", ")}.` });
    }
  }

  let startpasswort;
  if (admin) {
    startpasswort = erzeugeStartpasswort();
    if (pruefePasswort(startpasswort, admin.email).length > 0) {
      return res.status(500).json({ error: "Startpasswort ungültig erzeugt, bitte erneut versuchen." });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ein fehlgeschlagenes INSERT würde sonst die ganze Transaktion vergiften
    // (Postgres: "current transaction is aborted") -- jeder Versuch läuft
    // deshalb bis zu einem eigenen Savepoint, auf den ein Fehlschlag
    // zurückrollt, ohne die restliche Transaktion zu verlieren.
    let firmaRow;
    for (let versuch = 0; versuch < 50; versuch++) {
      const slug = versuch === 0 ? basisSlug : `${basisSlug}-${versuch + 1}`;
      await client.query("SAVEPOINT vor_firma_insert");
      try {
        const { rows } = await client.query(
          `INSERT INTO firmen (name, slug, strasse, plz, ort, ansprechpartner, rechnungs_email, telefon, ust_id_nr, notiz)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING ${FIRMA_SPALTEN}`,
          [name, slug, strasse, plz, ort, ansprechpartner, rechnungsEmail, telefon, ustIdNr, notiz]
        );
        firmaRow = rows[0];
        break;
      } catch (err) {
        if (err.code !== "23505") throw err;
        // Kürzel schon vergeben -- nächste Zahl versuchen.
        await client.query("ROLLBACK TO SAVEPOINT vor_firma_insert");
      }
    }
    if (!firmaRow) {
      throw new Error("Firma konnte nicht angelegt werden (kein freies Kürzel gefunden).");
    }

    // Ab hier greift RLS (firma_module, rechte, users) -- wie withFirma(),
    // hier manuell auf demselben Client, weil die ganze Anlage eine
    // Transaktion sein muss.
    await client.query("SELECT set_config('app.current_firma_id', $1, true)", [String(firmaRow.id)]);
    await rechteStandardAnlegen(client, firmaRow.id, appConfig.standardRechte);

    for (const modulName of gewaehlt) {
      const eintrag = alleModule.find((m) => m.name === modulName);
      await client.query("INSERT INTO firma_module (firma_id, modul, aktiv) VALUES ($1, $2, true)", [
        firmaRow.id,
        modulName,
      ]);
      await rechteFuerBausteinAnlegen(client, firmaRow.id, eintrag.config.rechteBereiche);
    }

    let adminErgebnis = null;
    if (admin) {
      const hash = await hashPassword(startpasswort);
      const { rows } = await client.query(
        `INSERT INTO users (firma_id, email, passwort_hash, name, rolle, muss_passwort_aendern)
         VALUES ($1, $2, $3, $4, 'Admin', true)
         RETURNING id, email, name`,
        [firmaRow.id, admin.email, hash, admin.name]
      );
      adminErgebnis = { ...rows[0], startpasswort };
    }

    await client.query("COMMIT");
    res.status(201).json({ ...firmaRow, admin: adminErgebnis });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(400).json({ error: "Firma konnte nicht angelegt werden (E-Mail des Admins schon vergeben?)." });
    }
    res.status(400).json({ error: err.message || "Firma konnte nicht angelegt werden." });
  } finally {
    client.release();
  }
});

// Teilweise Änderungen behalten die übrigen Felder bei -- deshalb zuerst die
// bestehende Zeile lesen und fehlende Felder daraus auffüllen, statt sie
// unbeabsichtigt zu überschreiben. Die Kundendaten-Pflichtfelder werden nur
// geprüft, wenn mindestens eines davon im Formular steht (Bestandsfirmen vor
// dem ersten Bearbeiten haben sie noch leer, Abschnitt 6: nichts wird in
// diesem Zug erzwungen, was vorher nicht da war).
router.patch("/firmen/:id", async (req, res) => {
  const { rows: bestehend } = await pool.query(`SELECT ${FIRMA_SPALTEN} FROM firmen WHERE id = $1`, [
    req.params.id,
  ]);
  if (!bestehend[0]) return res.status(404).json({ error: "Firma nicht gefunden." });
  const alt = bestehend[0];

  // Nur prüfen, wenn das Bearbeiten-Fenster tatsächlich Kundendaten mitschickt
  // -- ein einzelner Sperren/Entsperren-Klick (nur "aktiv" im Body) lässt eine
  // Bestandsfirma mit noch leeren Pflichtfeldern unverändert in Ruhe.
  const kundendatenImFormular = enthaeltKundendatenFeld(req.body);

  const name = String(req.body?.name ?? alt.name).trim();
  const slug = req.body?.slug ?? alt.slug;
  const aktiv = req.body?.aktiv !== undefined ? !!req.body.aktiv : alt.aktiv;
  const strasse = String(req.body?.strasse ?? alt.strasse ?? "").trim();
  const plz = String(req.body?.plz ?? alt.plz ?? "").trim();
  const ort = String(req.body?.ort ?? alt.ort ?? "").trim();
  const ansprechpartner = String(req.body?.ansprechpartner ?? alt.ansprechpartner ?? "").trim();
  const rechnungsEmail = String(req.body?.rechnungsEmail ?? alt.rechnungs_email ?? "").trim();
  const telefon = req.body?.telefon ?? alt.telefon;
  const ustIdNr = req.body?.ustIdNr ?? alt.ust_id_nr;
  const notiz = req.body?.notiz ?? alt.notiz;

  if (kundendatenImFormular) {
    if (!name) return res.status(400).json({ error: "Bitte Name angeben." });
    if (!strasse) return res.status(400).json({ error: "Bitte Straße angeben." });
    const plzFehler = pruefePlz(plz);
    if (!plz || plzFehler) return res.status(400).json({ error: plzFehler || "Bitte PLZ angeben." });
    if (!ort) return res.status(400).json({ error: "Bitte Ort angeben." });
    if (!ansprechpartner) return res.status(400).json({ error: "Bitte Ansprechpartner angeben." });
    if (!EMAIL_MUSTER.test(rechnungsEmail)) {
      return res.status(400).json({ error: "Bitte eine gültige Rechnungs-E-Mail angeben." });
    }
  }
  if (req.body?.ustIdNr !== undefined) {
    const ustIdNrFehler = pruefeUstIdNr(ustIdNr);
    if (ustIdNrFehler) return res.status(400).json({ error: ustIdNrFehler });
  }

  let geaendert;
  try {
    const { rows } = await pool.query(
      `UPDATE firmen SET name = $2, slug = $3, aktiv = $4, strasse = $5, plz = $6, ort = $7,
              ansprechpartner = $8, rechnungs_email = $9, telefon = $10, ust_id_nr = $11, notiz = $12
       WHERE id = $1 RETURNING ${FIRMA_SPALTEN}`,
      [req.params.id, name, slug, aktiv, strasse || null, plz || null, ort || null, ansprechpartner || null,
        rechnungsEmail || null, telefon, ustIdNr, notiz]
    );
    geaendert = rows[0];
  } catch (err) {
    return res.status(400).json({ error: "Firma konnte nicht gespeichert werden (Kürzel schon vergeben?)." });
  }

  // Gesperrt: alle Sitzungen dieser Firma sofort beenden (nicht erst beim
  // nächsten Login). Außerhalb des try, damit ein Datenbankfehler hier nicht
  // als "Kürzel schon vergeben" gemeldet wird.
  if (!aktiv) {
    await pool.query("DELETE FROM sessions WHERE firma_id = $1", [req.params.id]);
  }
  res.json(geaendert);
});

function enthaeltKundendatenFeld(body) {
  return ["strasse", "plz", "ort", "ansprechpartner", "rechnungsEmail"].some(
    (feld) => body?.[feld] !== undefined
  );
}

// Firma endgültig löschen (Punkt 0.4): nur gesperrt, nur mit exakt eingetipptem
// Namen. Die eigentliche Löschung läuft in einer eng begrenzten Datenbank-
// Funktion (SECURITY DEFINER, Migration 0019) -- die App-Rolle darf das
// Änderungsprotokoll sonst nicht löschen.
router.delete("/firmen/:id", async (req, res) => {
  const firmaId = Number(req.params.id);
  const nameBestaetigung = req.body?.nameBestaetigung || "";

  try {
    const { rows } = await pool.query(
      "SELECT firma_endgueltig_loeschen($1, $2, $3) AS bereiche",
      [firmaId, nameBestaetigung, req.user.id]
    );
    res.json({ bereiche: rows[0].bereiche });
  } catch (err) {
    res.status(400).json({ error: err.message || "Firma konnte nicht gelöscht werden." });
  }
});

// Ersten Firmen-Admin einladen (Abschnitt 8). Startpasswort kommt einmalig in
// der Antwort zurück, Björn gibt es dem Kunden weiter; beim ersten Login
// erzwingt muss_passwort_aendern den Wechsel.
router.post("/firmen/:id/einladen", async (req, res) => {
  const firmaId = Number(req.params.id);
  const { email, name } = req.body || {};
  if (!email || !name) {
    return res.status(400).json({ error: "Bitte Name und E-Mail angeben." });
  }

  const startpasswort = erzeugeStartpasswort();
  if (pruefePasswort(startpasswort, email).length > 0) {
    return res.status(500).json({ error: "Startpasswort ungültig erzeugt, bitte erneut versuchen." });
  }
  const hash = await hashPassword(startpasswort);

  try {
    await withFirma(firmaId, (client) =>
      rechteStandardAnlegen(client, firmaId, appConfig.standardRechte)
    );
    const rows = await withFirma(firmaId, (client) =>
      client
        .query(
          `INSERT INTO users (firma_id, email, passwort_hash, name, rolle, muss_passwort_aendern)
           VALUES ($1, $2, $3, $4, 'Admin', true)
           RETURNING id, email, name`,
          [firmaId, email, hash, name]
        )
        .then((r) => r.rows)
    );
    res.status(201).json({ ...rows[0], startpasswort });
  } catch (err) {
    res.status(400).json({ error: "Einladung fehlgeschlagen (E-Mail schon vergeben?)." });
  }
});

// Baustein-Katalog dieser App, ohne Firmenbezug (Teil B): für den
// "Neue Firma"-Dialog, bevor die Firma überhaupt existiert -- danach zeigt
// "/firmen/:id/module" zusätzlich, was davon schon freigeschaltet ist.
router.get("/module", async (req, res) => {
  const module = await ladeModule();
  res.json(
    module.map(({ name, config }) => ({
      name,
      titel: config.titel || name,
      beschreibung: config.beschreibung || "",
      braucht: config.braucht || [],
    }))
  );
});

// Seite "Bausteine" pro Firma (Abschnitt 8): zeigt, was diese App anbietet,
// und was die Firma davon bereits hat.
router.get("/firmen/:id/module", async (req, res) => {
  const firmaId = Number(req.params.id);
  const module = await ladeModule();
  const rows = await withFirma(firmaId, (client) =>
    client
      .query("SELECT modul, aktiv FROM firma_module WHERE firma_id = $1", [firmaId])
      .then((r) => r.rows)
  );
  const aktivMap = Object.fromEntries(rows.map((r) => [r.modul, r.aktiv]));

  res.json(
    module.map(({ name, config }) => ({
      name,
      titel: config.titel || name,
      beschreibung: config.beschreibung || "",
      braucht: config.braucht || [],
      aktiv: aktivMap[name] === true,
    }))
  );
});

router.patch("/firmen/:id/module/:modul", async (req, res) => {
  const firmaId = Number(req.params.id);
  const { modul } = req.params;
  const aktiv = !!req.body?.aktiv;

  const module = await ladeModule();
  const eintrag = module.find((m) => m.name === modul);
  if (!eintrag) return res.status(404).json({ error: "Baustein nicht gefunden." });

  if (aktiv) {
    const rows = await withFirma(firmaId, (client) =>
      client
        .query("SELECT modul FROM firma_module WHERE firma_id = $1 AND aktiv = true", [firmaId])
        .then((r) => r.rows)
    );
    const aktiveModule = new Set(rows.map((r) => r.modul));
    const fehlend = fehlendeAbhaengigkeiten(eintrag.config.braucht, aktiveModule);
    if (fehlend.length > 0) {
      return res.status(400).json({ error: `Braucht zuerst: ${fehlend.join(", ")}.` });
    }
  }

  await withFirma(firmaId, async (client) => {
    await client.query(
      `INSERT INTO firma_module (firma_id, modul, aktiv) VALUES ($1, $2, $3)
       ON CONFLICT (firma_id, modul) DO UPDATE SET aktiv = EXCLUDED.aktiv`,
      [firmaId, modul, aktiv]
    );
    // Beim Freischalten bringt der Baustein seine eigenen Rechte-Bereiche mit
    // (Abschnitt 8) -- ohne das wäre der Bereich in "rechte" unbekannt und
    // niemand (auch kein Admin) dürfte etwas damit tun.
    if (aktiv) {
      await rechteFuerBausteinAnlegen(client, firmaId, eintrag.config.rechteBereiche);
    }
  });

  res.json({ modul, aktiv });
});

export default router;
