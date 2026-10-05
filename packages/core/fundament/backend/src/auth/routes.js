import { Router } from "express";
import { pool } from "../db/pool.js";
import { withFirma } from "../db/withFirma.js";
import { verifyPassword, hashPassword, pruefePasswort } from "./password.js";
import { tokenHash } from "./session.js";
import { loescheSessionCookie, leseSessionToken } from "./cookies.js";
import { authenticate } from "./middleware.js";
import { sitzungErstellen } from "./anmelden.js";

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

  if (!benutzer || !benutzer.aktiv || !benutzer.firma_aktiv || !passwortOk) {
    await protokolliereVersuch(email, false, req.ip);
    return res.status(401).json({ error: GENERISCHER_FEHLER });
  }

  await protokolliereVersuch(email, true, req.ip);

  res.json(await sitzungErstellen(benutzer, req, res));
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

// Startpasswort nach einer Superadmin-Einladung muss geändert werden
// (Abschnitt 8, Anhang A.4), aber auch sonst jederzeit nutzbar.
router.post("/passwort-aendern", async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) {
    return res.status(401).json({ error: "Nicht angemeldet." });
  }

  const { aktuellesPasswort, neuesPasswort } = req.body || {};
  if (!aktuellesPasswort || !neuesPasswort) {
    return res.status(400).json({ error: "Bitte aktuelles und neues Passwort angeben." });
  }

  const laden = (client) =>
    client
      .query("SELECT email, passwort_hash FROM users WHERE id = $1", [user.id])
      .then((r) => r.rows[0]);
  // Superadmin hat keine Firma: die Mandanten-Trennung sieht seine Zeile nicht,
  // darum eng begrenzte Funktion (Migration 0013), nicht die normale Abfrage.
  const benutzer = user.firmaId
    ? await withFirma(user.firmaId, laden)
    : await pool
        .query("SELECT * FROM superadmin_passwort_lesen($1)", [user.id])
        .then((r) => r.rows[0]);

  if (!benutzer || !(await verifyPassword(aktuellesPasswort, benutzer.passwort_hash))) {
    return res.status(401).json({ error: "Aktuelles Passwort ist falsch." });
  }

  const fehlerListe = pruefePasswort(neuesPasswort, benutzer.email);
  if (fehlerListe.length > 0) {
    return res.status(400).json({ error: fehlerListe[0] });
  }

  const neuerHash = await hashPassword(neuesPasswort);
  if (user.firmaId) {
    await withFirma(user.firmaId, (client) =>
      client.query(
        "UPDATE users SET passwort_hash = $2, muss_passwort_aendern = false WHERE id = $1",
        [user.id, neuerHash]
      )
    );
  } else {
    await pool.query("SELECT superadmin_passwort_setzen($1, $2)", [user.id, neuerHash]);
  }

  // Nach dem Wechsel alle anderen Sitzungen dieses Nutzers beenden; die
  // aktuelle bleibt bestehen (B3).
  await pool.query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [
    user.id,
    tokenHash(leseSessionToken(req)),
  ]);

  res.json({ status: "ok" });
});

export default router;
