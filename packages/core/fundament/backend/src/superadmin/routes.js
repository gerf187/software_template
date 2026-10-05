import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth, requireSuperadmin } from "../auth/middleware.js";
import { pool } from "../db/pool.js";
import { withFirma } from "../db/withFirma.js";
import { hashPassword, pruefePasswort } from "../auth/password.js";
import { rechteStandardAnlegen, rechteFuerBausteinAnlegen } from "../rechte/standardAnlegen.js";
import { fehlendeAbhaengigkeiten } from "../module/abhaengigkeiten.js";
import appConfig from "../appConfig.js";
import { ladeModule } from "../module/lade.js";
import { pruefeIdsAusUrl } from "../db/ids.js";

const router = Router();
pruefeIdsAusUrl(router, ["id"]);
router.use(requireAuth, requireSuperadmin);

// Firmen anlegen/sperren (Abschnitt 7). "firmen" hat kein RLS -- wird nur
// über diese Superadmin-Routen verwaltet (siehe Migration 0001).
router.get("/firmen", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, slug, aktiv, erstellt_am FROM firmen ORDER BY name"
  );
  res.json(rows);
});

router.post("/firmen", async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: "Bitte Name und Kürzel (Slug) angeben." });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO firmen (name, slug) VALUES ($1, $2) RETURNING id, name, slug, aktiv, erstellt_am",
      [name, slug]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: "Firma konnte nicht angelegt werden (Kürzel schon vergeben?)." });
  }
});

// Teilweise Änderungen (z. B. nur "aktiv" beim Sperren/Entsperren) behalten die
// übrigen Felder bei -- deshalb zuerst die bestehende Zeile lesen und fehlende
// Felder daraus auffüllen, statt sie unbeabsichtigt zu überschreiben.
router.patch("/firmen/:id", async (req, res) => {
  const { rows: bestehend } = await pool.query(
    "SELECT name, slug, aktiv FROM firmen WHERE id = $1",
    [req.params.id]
  );
  if (!bestehend[0]) return res.status(404).json({ error: "Firma nicht gefunden." });

  const name = req.body?.name ?? bestehend[0].name;
  const slug = req.body?.slug ?? bestehend[0].slug;
  const aktiv = req.body?.aktiv !== undefined ? !!req.body.aktiv : bestehend[0].aktiv;

  try {
    const { rows } = await pool.query(
      "UPDATE firmen SET name = $2, slug = $3, aktiv = $4 WHERE id = $1 RETURNING id, name, slug, aktiv, erstellt_am",
      [req.params.id, name, slug, aktiv]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: "Firma konnte nicht gespeichert werden (Kürzel schon vergeben?)." });
  }
});

function erzeugeStartpasswort() {
  // Lang genug für Anhang A.4 (mind. 12 Zeichen), ohne verwechselbare
  // Sonderzeichen -- muss beim ersten Login ohnehin geändert werden.
  return crypto.randomBytes(12).toString("base64url");
}

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
