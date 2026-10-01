import { pool } from "../db/pool.js";
import { withFirma } from "../db/withFirma.js";
import { leseSessionToken, loescheSessionCookie } from "./cookies.js";
import { tokenHash } from "./session.js";
import { holeRechteFuerRolle } from "../rechte/holeRechte.js";

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
            "SELECT id, name, rolle, aktiv FROM users WHERE id = $1",
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
  return { id: user.id, name: user.name, rolle: user.rolle, firmaId: session.firma_id, rechte };
}

export async function requireAuth(req, res, next) {
  const user = await authenticate(req, res);
  if (!user) {
    return res.status(401).json({ error: "Nicht angemeldet." });
  }
  req.user = user;
  next();
}
