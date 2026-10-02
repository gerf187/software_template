import { pool } from "../db/pool.js";

// Anzeige-Infos der eigenen Firma (Name, Logo, Akzentfarbe) fürs Fundament --
// genutzt beim Login und bei /api/auth/me, damit die Sidebar sie sofort hat.
// "firmen" hat kein RLS (Migration 0001), wird hier aber ausschließlich mit
// der firma_id aus der Session abgefragt (Abschnitt 6, Regel 3).
export async function holeFirmaAnzeige(firmaId) {
  if (!firmaId) return null; // Superadmin hat keine Firma (Abschnitt 7).

  const { rows } = await pool.query("SELECT name, einstellungen FROM firmen WHERE id = $1", [
    firmaId,
  ]);
  const firma = rows[0];
  if (!firma) return null;

  return {
    name: firma.name,
    logo: firma.einstellungen?.logo || null,
    akzentfarbe: firma.einstellungen?.akzentfarbe || null,
  };
}
