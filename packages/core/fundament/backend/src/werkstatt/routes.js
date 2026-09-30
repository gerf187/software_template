import { Router } from "express";
import { pool } from "../db/pool.js";
import { verifyPassword } from "../auth/password.js";
import { leseSessionToken } from "../auth/cookies.js";
import { tokenHash } from "../auth/session.js";
import { sitzungErstellen } from "../auth/anmelden.js";
import { WERKSTATT_PASSWORT, WERKSTATT_NUTZER } from "./nutzer.js";

const router = Router();
const ERLAUBTE_EMAILS = new Set(WERKSTATT_NUTZER.map((n) => n.email));

router.get("/nutzer", (req, res) => {
  res.json(WERKSTATT_NUTZER);
});

router.post("/anmelden-als", async (req, res) => {
  const { email } = req.body || {};
  if (!ERLAUBTE_EMAILS.has(email)) {
    return res.status(400).json({ error: "Unbekanntes Werkstatt-Test-Konto." });
  }

  const alterToken = leseSessionToken(req);
  if (alterToken) {
    await pool.query("DELETE FROM sessions WHERE id = $1", [tokenHash(alterToken)]);
  }

  const { rows } = await pool.query("SELECT * FROM login_lookup($1)", [email]);
  const benutzer = rows[0];
  if (!benutzer || !(await verifyPassword(WERKSTATT_PASSWORT, benutzer.passwort_hash))) {
    return res.status(404).json({
      error: "Werkstatt-Test-Konto nicht gefunden. Erst 'npm run db:seed:werkstatt' ausführen.",
    });
  }

  res.json(await sitzungErstellen(benutzer, req, res));
});

export default router;
