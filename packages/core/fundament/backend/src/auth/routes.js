import { Router } from "express";
import { pool } from "../db/pool.js";
import { verifyPassword } from "./password.js";
import { neuesToken, tokenHash } from "./session.js";
import { setzeSessionCookie, loescheSessionCookie, leseSessionToken } from "./cookies.js";
import { authenticate } from "./middleware.js";

const router = Router();

const GENERISCHER_FEHLER = "E-Mail oder Passwort falsch.";
// Fester Dummy-Hash, damit ein Login mit unbekannter E-Mail genauso lange
// dauert wie mit bekannter -- verrät sonst per Zeitmessung, ob es die
// E-Mail gibt.
const DUMMY_HASH = "$2b$12$CwX0fFtBf6aLXyjO1n9L8OUh2Rmemq4aWQzxQIjq0w1JmXJ8kQ9wK";

async function zuVieleFehlversuche(email) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS anzahl FROM login_versuche
     WHERE lower(email) = lower($1) AND erfolgreich = false
       AND zeitpunkt > now() - interval '15 minutes'`,
    [email]
  );
  return rows[0].anzahl >= 5;
}

async function protokolliereVersuch(email, erfolgreich, ip) {
  await pool.query(
    "INSERT INTO login_versuche (email, erfolgreich, ip_adresse) VALUES ($1, $2, $3)",
    [email, erfolgreich, ip]
  );
}

router.post("/login", async (req, res) => {
  const { email, passwort } = req.body || {};
  if (!email || !passwort) {
    return res.status(400).json({ error: "Bitte E-Mail und Passwort angeben." });
  }

  if (await zuVieleFehlversuche(email)) {
    return res
      .status(429)
      .json({ error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." });
  }

  const { rows } = await pool.query("SELECT * FROM login_lookup($1)", [email]);
  const benutzer = rows[0];

  const passwortOk = await verifyPassword(passwort, benutzer ? benutzer.passwort_hash : DUMMY_HASH);

  if (!benutzer || !benutzer.aktiv || !passwortOk) {
    await protokolliereVersuch(email, false, req.ip);
    return res.status(401).json({ error: GENERISCHER_FEHLER });
  }

  await protokolliereVersuch(email, true, req.ip);

  const token = neuesToken();
  await pool.query(
    `INSERT INTO sessions (id, user_id, firma_id, expires_at, ip_adresse, user_agent)
     VALUES ($1, $2, $3, now() + interval '7 days', $4, $5)`,
    [tokenHash(token), benutzer.id, benutzer.firma_id, req.ip, req.headers["user-agent"] || null]
  );

  setzeSessionCookie(res, token);
  res.json({ id: benutzer.id, name: benutzer.name, rolle: benutzer.rolle, firmaId: benutzer.firma_id });
});

router.post("/logout", async (req, res) => {
  const token = leseSessionToken(req);
  if (token) {
    await pool.query("DELETE FROM sessions WHERE id = $1", [tokenHash(token)]);
  }
  loescheSessionCookie(res);
  res.json({ status: "ok" });
});

router.get("/me", async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) {
    return res.status(401).json({ error: "Nicht angemeldet." });
  }
  res.json(user);
});

export default router;
