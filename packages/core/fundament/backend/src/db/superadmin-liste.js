import { fileURLToPath } from "node:url";
import { eigentuemerVerbindung } from "./eigentuemerVerbindung.js";

// Kommandozeilen-Befehl: zeigt alle Superadmin-Konten (Abschnitt 7), damit
// Björn vor einem Zurücksetzen/Deaktivieren weiß, welche E-Mail-Adressen es
// gibt. Keine Web-Route, wie die anderen Superadmin-Befehle.
export async function listeSuperadmins(verbindung) {
  const { rows } = await verbindung.query(
    `SELECT u.email, u.name, u.aktiv,
            (SELECT max(lv.zeitpunkt) FROM login_versuche lv
             WHERE lower(lv.email) = lower(u.email) AND lv.erfolgreich = true) AS letzter_login
     FROM users u
     WHERE u.rolle = 'Superadmin'
     ORDER BY u.email`
  );
  return rows;
}

async function kommandozeile() {
  const pool = eigentuemerVerbindung();
  try {
    const liste = await listeSuperadmins(pool);
    if (liste.length === 0) {
      console.log("Noch kein Superadmin-Konto angelegt.");
      return 0;
    }
    console.log("");
    for (const s of liste) {
      const letzterLogin = s.letzter_login ? new Date(s.letzter_login).toLocaleString("de-DE") : "noch nie";
      console.log(`${s.aktiv ? "aktiv    " : "deaktiviert"}  ${s.email}  (${s.name})  -- letzter Login: ${letzterLogin}`);
    }
    console.log("");
    return 0;
  } catch (err) {
    console.error(`Abbruch: ${err.message}`);
    return 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await kommandozeile();
}
