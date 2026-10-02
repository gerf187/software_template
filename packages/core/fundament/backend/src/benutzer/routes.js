import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../auth/middleware.js";
import { erfordertRecht } from "../rechte/darf.js";
import { withFirma } from "../db/withFirma.js";
import { hashPassword } from "../auth/password.js";

const router = Router();

// Rollen innerhalb einer Firma (Abschnitt 7). "Superadmin" ist eine
// Plattform-Rolle ohne Firma und entsteht nie über diese Routen.
const ROLLEN = ["Admin", "Mitarbeiter", "Betrachter"];

const BENUTZER_SPALTEN = "id, email, name, rolle, aktiv, muss_passwort_aendern, erstellt_am";

function erzeugeStartpasswort() {
  return crypto.randomBytes(12).toString("base64url");
}

// Schützt davor, dass sich ein Admin selbst herabstuft/archiviert oder der
// letzte aktive Admin einer Firma verschwindet (Abschnitt 7). Wird vor jeder
// Änderung geprüft, die eine Admin-Rolle oder den Aktiv-Status wegnehmen könnte.
async function pruefeAdminSchutz(client, { zielId, istSelbst, warAdmin, neueRolle, neuAktiv }) {
  if (!warAdmin) return null;
  const bleibtAdmin = neueRolle === "Admin" && neuAktiv;
  if (bleibtAdmin) return null;

  if (istSelbst) {
    return "Du kannst dich nicht selbst herabstufen oder archivieren.";
  }

  const { rows } = await client.query(
    "SELECT count(*)::int AS anzahl FROM users WHERE rolle = 'Admin' AND aktiv = true AND id != $1",
    [zielId]
  );
  if (rows[0].anzahl === 0) {
    return "Der letzte Admin einer Firma kann nicht entfernt werden.";
  }
  return null;
}

router.use(requireAuth);

router.get("/", erfordertRecht("benutzer", "sehen"), async (req, res) => {
  const rows = await withFirma(req.user.firmaId, (client) =>
    client
      .query(`SELECT ${BENUTZER_SPALTEN} FROM users ORDER BY name`)
      .then((r) => r.rows)
  );
  res.json(rows);
});

// Benutzer einladen: legt das Konto mit Startpasswort an, das beim ersten
// Login geändert werden muss (gleiches Muster wie die Superadmin-Einladung).
router.post("/", erfordertRecht("benutzer", "bearbeiten"), async (req, res) => {
  const { email, name, rolle } = req.body || {};
  if (!email || !name || !rolle) {
    return res.status(400).json({ error: "Bitte Name, E-Mail und Rolle angeben." });
  }
  if (!ROLLEN.includes(rolle)) {
    return res.status(400).json({ error: "Ungültige Rolle." });
  }

  const startpasswort = erzeugeStartpasswort();
  const hash = await hashPassword(startpasswort);

  try {
    const rows = await withFirma(
      req.user.firmaId,
      (client) =>
        client
          .query(
            `INSERT INTO users (firma_id, email, passwort_hash, name, rolle, muss_passwort_aendern)
             VALUES ($1, $2, $3, $4, $5, true)
             RETURNING ${BENUTZER_SPALTEN}`,
            [req.user.firmaId, email, hash, name, rolle]
          )
          .then((r) => r.rows),
      { userId: req.user.id }
    );
    res.status(201).json({ ...rows[0], startpasswort });
  } catch (err) {
    res.status(400).json({ error: "Benutzer konnte nicht angelegt werden (E-Mail schon vergeben?)." });
  }
});

router.put("/:id", erfordertRecht("benutzer", "bearbeiten"), async (req, res) => {
  const zielId = Number(req.params.id);
  const { email, name, rolle } = req.body || {};
  if (!email || !name || !rolle) {
    return res.status(400).json({ error: "Bitte Name, E-Mail und Rolle angeben." });
  }
  if (!ROLLEN.includes(rolle)) {
    return res.status(400).json({ error: "Ungültige Rolle." });
  }

  try {
    const fehler = await withFirma(
      req.user.firmaId,
      async (client) => {
        const bestehend = await client.query("SELECT rolle, aktiv FROM users WHERE id = $1", [zielId]);
        if (!bestehend.rows[0]) return "NOT_FOUND";

        const schutzFehler = await pruefeAdminSchutz(client, {
          zielId,
          istSelbst: zielId === req.user.id,
          warAdmin: bestehend.rows[0].rolle === "Admin",
          neueRolle: rolle,
          neuAktiv: bestehend.rows[0].aktiv,
        });
        if (schutzFehler) return schutzFehler;

        await client.query(
          "UPDATE users SET email = $2, name = $3, rolle = $4 WHERE id = $1",
          [zielId, email, name, rolle]
        );
        return null;
      },
      { userId: req.user.id }
    );

    if (fehler === "NOT_FOUND") return res.status(404).json({ error: "Benutzer nicht gefunden." });
    if (fehler) return res.status(400).json({ error: fehler });

    const rows = await withFirma(req.user.firmaId, (client) =>
      client.query(`SELECT ${BENUTZER_SPALTEN} FROM users WHERE id = $1`, [zielId]).then((r) => r.rows)
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: "Benutzer konnte nicht gespeichert werden (E-Mail schon vergeben?)." });
  }
});

// Archivieren/Reaktivieren statt Löschen (Abschnitt 7, Anhang-Regel
// "Löschen immer über Dialog" gilt im Frontend; hier nur der Statuswechsel).
router.patch("/:id/aktiv", erfordertRecht("benutzer", "loeschen"), async (req, res) => {
  const zielId = Number(req.params.id);
  const neuAktiv = !!req.body?.aktiv;

  const fehler = await withFirma(
    req.user.firmaId,
    async (client) => {
      const bestehend = await client.query("SELECT rolle, aktiv FROM users WHERE id = $1", [zielId]);
      if (!bestehend.rows[0]) return "NOT_FOUND";

      const schutzFehler = await pruefeAdminSchutz(client, {
        zielId,
        istSelbst: zielId === req.user.id,
        warAdmin: bestehend.rows[0].rolle === "Admin",
        neueRolle: bestehend.rows[0].rolle,
        neuAktiv,
      });
      if (schutzFehler) return schutzFehler;

      await client.query("UPDATE users SET aktiv = $2 WHERE id = $1", [zielId, neuAktiv]);
      return null;
    },
    { userId: req.user.id }
  );

  if (fehler === "NOT_FOUND") return res.status(404).json({ error: "Benutzer nicht gefunden." });
  if (fehler) return res.status(400).json({ error: fehler });

  const rows = await withFirma(req.user.firmaId, (client) =>
    client.query(`SELECT ${BENUTZER_SPALTEN} FROM users WHERE id = $1`, [zielId]).then((r) => r.rows)
  );
  res.json(rows[0]);
});

export default router;
