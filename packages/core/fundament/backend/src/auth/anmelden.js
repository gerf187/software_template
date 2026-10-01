import { pool } from "../db/pool.js";
import { neuesToken, tokenHash } from "./session.js";
import { setzeSessionCookie } from "./cookies.js";
import { holeRechteFuerRolle } from "../rechte/holeRechte.js";

// Legt die Sitzung an und setzt das Cookie. Genutzt vom normalen Login und
// vom Werkstatt-Rollen-Umschalter (beide melden am Ende genau gleich an).
export async function sitzungErstellen(benutzer, req, res) {
  const token = neuesToken();
  await pool.query(
    `INSERT INTO sessions (id, user_id, firma_id, expires_at, ip_adresse, user_agent)
     VALUES ($1, $2, $3, now() + interval '7 days', $4, $5)`,
    [tokenHash(token), benutzer.id, benutzer.firma_id, req.ip, req.headers["user-agent"] || null]
  );
  setzeSessionCookie(res, token);
  const rechte = await holeRechteFuerRolle(benutzer.firma_id, benutzer.rolle);
  return {
    id: benutzer.id,
    name: benutzer.name,
    rolle: benutzer.rolle,
    firmaId: benutzer.firma_id,
    rechte,
  };
}
