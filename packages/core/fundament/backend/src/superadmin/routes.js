import { Router } from "express";
import { erzeugeStartpasswort } from "../auth/startpasswort.js";
import { requireAuth, requireSuperadmin } from "../auth/middleware.js";
import { pool } from "../db/pool.js";
import { withFirma } from "../db/withFirma.js";
import { hashPassword, pruefePasswort } from "../auth/password.js";
import { rechteStandardAnlegen, rechteFuerBausteinAnlegen } from "../rechte/standardAnlegen.js";
import { fehlendeAbhaengigkeiten } from "../module/abhaengigkeiten.js";
import appConfig from "../appConfig.js";
import { ladeModule } from "../module/lade.js";
import { pruefeIdsAusUrl } from "../db/ids.js";
import { erzeugeSlugAusName } from "./slug.js";

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

// Kürzel (Slug) kommt nicht aus dem Formular, sondern wird aus dem Namen
// erzeugt (Abschnitt 7). Bei Doppelung hängt eine Zahl an -- die Schleife
// verlässt sich auf die UNIQUE-Regel der Datenbank (Migration 0001), damit
// zwei gleichzeitige Anlagen nie denselben Slug bekommen.
router.post("/firmen", async (req, res) => {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: "Bitte Name angeben." });
  }
  const basisSlug = erzeugeSlugAusName(name);
  if (!basisSlug) {
    return res.status(400).json({ error: "Aus diesem Namen kann kein Kürzel erzeugt werden." });
  }

  for (let versuch = 0; versuch < 50; versuch++) {
    const slug = versuch === 0 ? basisSlug : `${basisSlug}-${versuch + 1}`;
    try {
      const { rows } = await pool.query(
        "INSERT INTO firmen (name, slug) VALUES ($1, $2) RETURNING id, name, slug, aktiv, erstellt_am",
        [name, slug]
      );
      return res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code !== "23505") {
        return res.status(400).json({ error: "Firma konnte nicht angelegt werden." });
      }
      // Kürzel schon vergeben -- nächste Zahl versuchen.
    }
  }
  res.status(400).json({ error: "Firma konnte nicht angelegt werden (kein freies Kürzel gefunden)." });
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

  let geaendert;
  try {
    const { rows } = await pool.query(
      "UPDATE firmen SET name = $2, slug = $3, aktiv = $4 WHERE id = $1 RETURNING id, name, slug, aktiv, erstellt_am",
      [req.params.id, name, slug, aktiv]
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
