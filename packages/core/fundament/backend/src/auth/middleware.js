import { pool } from "../db/pool.js";
import { withFirma } from "../db/withFirma.js";
import { leseSessionToken, loescheSessionCookie } from "./cookies.js";
import { tokenHash } from "./session.js";
import { holeRechteFuerRolle } from "../rechte/holeRechte.js";
import { holeAktiveModule } from "../module/firmaModule.js";
import { holeFirmaAnzeige } from "../firma/firmaAnzeige.js";

// Meldung, wenn die Firma gesperrt ist (Login mit richtigem Passwort und laufende Sitzung).
export const SPERRE_MELDUNG = "Ihr Zugang ist gesperrt. Bitte wenden Sie sich an den Anbieter.";

// Prüft die Sitzung aus dem Cookie, verlängert sie gleitend (7 Tage) und
// liefert den zugehörigen, noch aktiven Benutzer -- oder null.
export async function authenticate(req, res) {
  const token = leseSessionToken(req);
  if (!token) return null;

  const hash = tokenHash(token);
  const { rows } = await pool.query(
    "SELECT user_id, firma_id, expires_at FROM sessions WHERE id = $1",
    [hash]
  );
  const session = rows[0];

  if (!session || new Date(session.expires_at) < new Date()) {
    loescheSessionCookie(res);
    return null;
  }

  // Gesperrte Firma: auch bestehende Sitzungen enden sofort (nicht erst beim
  // nächsten Login). Superadmin hat keine Firma, dort entfällt die Prüfung.
  if (session.firma_id !== null) {
    const { rows: firmaRows } = await pool.query("SELECT aktiv FROM firmen WHERE id = $1", [
      session.firma_id,
    ]);
    if (!firmaRows[0]?.aktiv) {
      await pool.query("DELETE FROM sessions WHERE id = $1", [hash]);
      loescheSessionCookie(res);
      res.locals.zugangGesperrt = true;
      return null;
    }
  }

  // Superadmin hat keine Firma -- für ihn kann withFirma() nicht greifen,
  // die Sitzungsprüfung läuft über eine eng begrenzte Ausnahme (wie beim
  // Login), nicht über die normale Mandanten-Trennung.
  const user =
    session.firma_id === null
      ? await pool
          .query("SELECT * FROM superadmin_lookup($1)", [session.user_id])
          .then((r) => r.rows[0])
      : await withFirma(session.firma_id, async (client) => {
          const result = await client.query(
            "SELECT id, name, rolle, aktiv, muss_passwort_aendern FROM users WHERE id = $1",
            [session.user_id]
          );
          return result.rows[0];
        });

  if (!user || !user.aktiv) {
    loescheSessionCookie(res);
    return null;
  }

  await pool.query(
    "UPDATE sessions SET expires_at = now() + interval '7 days', last_used_at = now() WHERE id = $1",
    [hash]
  );

  const rechte = await holeRechteFuerRolle(session.firma_id, user.rolle);
  const module = await holeAktiveModule(session.firma_id);
  const firma = await holeFirmaAnzeige(session.firma_id);
  return {
    id: user.id,
    name: user.name,
    rolle: user.rolle,
    firmaId: session.firma_id,
    firma,
    rechte,
    module,
    mussPasswortAendern: !!user.muss_passwort_aendern,
  };
}

export async function requireAuth(req, res, next) {
  const user = await authenticate(req, res);
  if (!user) {
    if (res.locals.zugangGesperrt) {
      return res.status(403).json({ error: SPERRE_MELDUNG, gesperrt: true });
    }
    return res.status(401).json({ error: "Nicht angemeldet." });
  }
  // Startpasswort muss zuerst geändert werden (Abschnitt 8): Alle geschützten
  // Routen sind gesperrt. Die Auth-Routen (/me, /passwort-aendern, /logout)
  // nutzen requireAuth nicht und bleiben erreichbar.
  if (user.mussPasswortAendern) {
    return res.status(403).json({
      error: "Bitte zuerst das Startpasswort ändern.",
      mussPasswortAendern: true,
    });
  }
  req.user = user;
  next();
}

// Superadmin ist eine Platform-Rolle, keine Fach-Berechtigung -- deshalb hier
// direkt geprüft statt über darf() (Abschnitt 7).
export function requireSuperadmin(req, res, next) {
  if (req.user?.rolle !== "Superadmin") {
    return res.status(403).json({ error: "Keine Berechtigung." });
  }
  next();
}
