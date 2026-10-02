import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../auth/middleware.js";
import { erfordertRecht, darf } from "../rechte/darf.js";
import { withFirma } from "../db/withFirma.js";
import { holeVerfuegbareKacheln } from "./kacheln.js";
import { gerenderteKacheln, layoutZumSpeichern } from "./layout.js";

const router = Router();
router.use(requireAuth);

function kontaktName(k) {
  return [k.vorname, k.nachname].filter(Boolean).join(" ") || "(ohne Namen)";
}

async function holeFirmenStandard(firmaId) {
  if (!firmaId) return [];
  const { rows } = await pool.query("SELECT einstellungen FROM firmen WHERE id = $1", [firmaId]);
  return rows[0]?.einstellungen?.dashboardStandard || [];
}

async function holeEigenesLayout(user) {
  if (!user.firmaId) return null;
  const rows = await withFirma(user.firmaId, (client) =>
    client
      .query("SELECT layout FROM benutzer_dashboard WHERE user_id = $1", [user.id])
      .then((r) => r.rows)
  );
  return rows[0]?.layout ?? null;
}

// Was gerade angezeigt werden soll: eigenes gespeichertes Layout, sonst
// Firmen-Standard, sonst leer (dann kommen alle verfügbaren Kacheln in
// Standard-Reihenfolge ans Ende, siehe gerenderteKacheln()).
async function holeAnzuzeigendesLayout(user) {
  const eigenes = await holeEigenesLayout(user);
  if (eigenes !== null) return eigenes;
  return holeFirmenStandard(user.firmaId);
}

router.get("/layout", async (req, res) => {
  const verfuegbar = await holeVerfuegbareKacheln(req.user);
  const layout = await holeAnzuzeigendesLayout(req.user);
  res.json(gerenderteKacheln(layout, verfuegbar));
});

router.put("/layout", async (req, res) => {
  if (!req.user.firmaId) {
    return res.status(400).json({ error: "Kein Dashboard-Layout für Superadmin." });
  }

  const verfuegbar = await holeVerfuegbareKacheln(req.user);
  const bestehend = await holeAnzuzeigendesLayout(req.user);
  const neuesLayout = layoutZumSpeichern(req.body?.layout, bestehend, verfuegbar);

  await withFirma(req.user.firmaId, (client) =>
    client.query(
      `INSERT INTO benutzer_dashboard (user_id, firma_id, layout, aktualisiert_am)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE SET layout = EXCLUDED.layout, aktualisiert_am = now()`,
      [req.user.id, req.user.firmaId, JSON.stringify(neuesLayout)]
    )
  );

  res.json(gerenderteKacheln(neuesLayout, verfuegbar));
});

// Zurücksetzen: eigene Anpassung löschen, danach gilt wieder der
// Firmen-Standard (oder die eingebaute Grundeinstellung).
router.delete("/layout", async (req, res) => {
  if (req.user.firmaId) {
    await withFirma(req.user.firmaId, (client) =>
      client.query("DELETE FROM benutzer_dashboard WHERE user_id = $1", [req.user.id])
    );
  }

  const verfuegbar = await holeVerfuegbareKacheln(req.user);
  const standard = await holeFirmenStandard(req.user.firmaId);
  res.json(gerenderteKacheln(standard, verfuegbar));
});

// Admin legt die eigene aktuelle Ansicht als Firmen-Standard fest (Abschnitt 8)
// -- neue Mitarbeiter starten damit, bis sie selbst etwas anpassen.
router.post(
  "/layout/standard",
  erfordertRecht("einstellungen", "bearbeiten"),
  async (req, res) => {
    const verfuegbar = await holeVerfuegbareKacheln(req.user);
    const eigenes = await holeAnzuzeigendesLayout(req.user);
    const standard = gerenderteKacheln(eigenes, verfuegbar).map(({ key, sichtbar, groesse }) => ({
      key,
      sichtbar,
      groesse,
    }));

    await pool.query(
      `UPDATE firmen
       SET einstellungen = jsonb_strip_nulls(
         einstellungen || jsonb_build_object('dashboardStandard', $2::jsonb)
       )
       WHERE id = $1`,
      [req.user.firmaId, JSON.stringify(standard)]
    );

    res.json({ status: "ok" });
  }
);

// Rohdaten für die Fundament-Kacheln, die Daten brauchen (Begrüßung braucht
// keine -- Name kommt aus /api/auth/me, Datum vom Browser). Jeder Schlüssel
// erscheint nur, wenn der Benutzer das nötige Recht hat.
router.get("/daten", async (req, res) => {
  const daten = {};

  if (await darf(req.user, "kontakte", "sehen")) {
    const ergebnisse = await withFirma(req.user.firmaId, async (client) => {
      const faellig = await client.query(
        `SELECT t.id, t.text, t.faellig_am, t.contact_id, c.vorname, c.nachname
         FROM tasks t
         JOIN contacts c ON c.id = t.contact_id
         WHERE t.status = 'offen' AND t.deleted_at IS NULL AND c.deleted_at IS NULL
           AND t.faellig_am IS NOT NULL AND t.faellig_am <= CURRENT_DATE
           AND (t.zustaendig_id IS NULL OR t.zustaendig_id = $1)
         ORDER BY t.faellig_am
         LIMIT 10`,
        [req.user.id]
      );
      const zuletzt = await client.query(
        `SELECT c.id, c.vorname, c.nachname, max(ap.zeitpunkt) AS zeitpunkt
         FROM aenderungsprotokoll ap
         JOIN contacts c ON c.id = ap.datensatz_id
         WHERE ap.tabelle = 'contacts'
         GROUP BY c.id, c.vorname, c.nachname
         ORDER BY max(ap.zeitpunkt) DESC
         LIMIT 5`
      );
      const neue = await client.query(
        "SELECT count(*)::int AS anzahl FROM contacts WHERE deleted_at IS NULL AND erstellt_am >= date_trunc('week', now())"
      );
      const gesamt = await client.query(
        "SELECT count(*)::int AS anzahl FROM contacts WHERE deleted_at IS NULL"
      );
      return {
        faellig: faellig.rows,
        zuletzt: zuletzt.rows,
        neue: neue.rows[0].anzahl,
        gesamt: gesamt.rows[0].anzahl,
      };
    });

    daten.meineAufgaben = ergebnisse.faellig.map((a) => ({
      id: a.id,
      text: a.text,
      faelligAm: a.faellig_am,
      kontaktId: a.contact_id,
      kontaktName: kontaktName(a),
    }));
    daten.zuletztBearbeiteteKontakte = ergebnisse.zuletzt.map((k) => ({
      id: k.id,
      name: kontaktName(k),
      zeitpunkt: k.zeitpunkt,
    }));
    daten.neueKontakte = ergebnisse.neue;
    daten.kontakteGesamt = ergebnisse.gesamt;
  }

  if (await darf(req.user, "protokoll", "sehen")) {
    const rows = await withFirma(req.user.firmaId, (client) =>
      client
        .query(
          `SELECT ap.id, ap.zeitpunkt, ap.aktion, ap.tabelle, u.name AS benutzer_name
           FROM aenderungsprotokoll ap
           LEFT JOIN users u ON u.id = ap.user_id
           ORDER BY ap.zeitpunkt DESC
           LIMIT 8`
        )
        .then((r) => r.rows)
    );
    daten.letzteAktivitaeten = rows.map((r) => ({
      id: r.id,
      zeitpunkt: r.zeitpunkt,
      aktion: r.aktion,
      tabelle: r.tabelle,
      benutzerName: r.benutzer_name,
    }));
  }

  res.json(daten);
});

export default router;
