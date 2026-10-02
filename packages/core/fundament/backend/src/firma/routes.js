import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../auth/middleware.js";
import { erfordertRecht } from "../rechte/darf.js";
import { holeFirmaAnzeige } from "./firmaAnzeige.js";

const router = Router();
router.use(requireAuth);

// Logo wird als Daten-URL (Text) direkt in der Datenbank gespeichert -- kein
// eigener Datei-Ordner, keine neue Abhängigkeit (Björns Entscheidung
// 2026-10-02 zu Schritt 2: Logo klein halten statt Datei-Upload-Technik).
const ERLAUBTE_LOGO_TYPEN = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_LAENGE = 280_000; // ~200 KB Bild als Daten-URL-Text
const HEX_FARBE = /^#[0-9a-fA-F]{6}$/;

function pruefeEinstellungen({ name, logo, akzentfarbe }) {
  if (!name || !name.trim()) return "Bitte einen Firmennamen angeben.";

  if (logo) {
    const treffer = /^data:(image\/[a-z]+);base64,/.exec(logo);
    if (!treffer || !ERLAUBTE_LOGO_TYPEN.includes(treffer[1])) {
      return "Logo muss ein PNG-, JPEG- oder WebP-Bild sein.";
    }
    if (logo.length > LOGO_MAX_LAENGE) {
      return "Logo ist zu groß (maximal ca. 200 KB).";
    }
  }

  if (akzentfarbe && !HEX_FARBE.test(akzentfarbe)) {
    return "Akzentfarbe muss ein Farbcode wie #2f7d5c sein.";
  }

  return null;
}

router.get("/einstellungen", erfordertRecht("einstellungen", "sehen"), async (req, res) => {
  const firma = await holeFirmaAnzeige(req.user.firmaId);
  res.json(firma || { name: "", logo: null, akzentfarbe: null });
});

// Nur Felder, die im Request-Body stehen, werden geändert -- fehlt ein Feld
// ganz (statt mit null geschickt zu werden), bleibt sein bisheriger Wert
// erhalten. So überschreibt diese Route nie künftige Schlüssel wie Fristen
// (Phase 2), die über ein anderes Formular gepflegt werden.
router.put("/einstellungen", erfordertRecht("einstellungen", "bearbeiten"), async (req, res) => {
  const body = req.body || {};
  const aktualisierung = {};
  if ("logo" in body) aktualisierung.logo = body.logo || null;
  if ("akzentfarbe" in body) aktualisierung.akzentfarbe = body.akzentfarbe || null;

  const fehler = pruefeEinstellungen({
    name: body.name,
    logo: aktualisierung.logo,
    akzentfarbe: aktualisierung.akzentfarbe,
  });
  if (fehler) return res.status(400).json({ error: fehler });

  await pool.query(
    `UPDATE firmen
     SET name = $2,
         einstellungen = jsonb_strip_nulls(einstellungen || $3::jsonb)
     WHERE id = $1`,
    [req.user.firmaId, body.name.trim(), JSON.stringify(aktualisierung)]
  );

  res.json(await holeFirmaAnzeige(req.user.firmaId));
});

export default router;
