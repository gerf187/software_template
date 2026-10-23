import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { eigentuemerVerbindung } from "./eigentuemerVerbindung.js";

// Kommandozeilen-Befehl: sperrt ein Superadmin-Konto (z. B. ein nicht mehr
// gebrauchtes Ersatzkonto). Nie das letzte aktive Superadmin-Konto, sonst
// gäbe es gar keinen Zugang mehr zur Plattform-Verwaltung (Abschnitt 7).
export async function deaktiviereSuperadmin(verbindung, { email }) {
  const eMail = (email || "").trim();
  if (!eMail) {
    throw new Error("Bitte eine E-Mail-Adresse angeben.");
  }

  const { rows } = await verbindung.query(
    "SELECT id, aktiv FROM users WHERE lower(email) = lower($1) AND rolle = 'Superadmin'",
    [eMail]
  );
  if (!rows[0]) {
    throw new Error(`Kein Superadmin-Konto mit der E-Mail-Adresse ${eMail} gefunden.`);
  }
  if (!rows[0].aktiv) {
    throw new Error("Dieses Konto ist schon deaktiviert.");
  }

  const { rows: aktiveRows } = await verbindung.query(
    "SELECT count(*)::int AS anzahl FROM users WHERE rolle = 'Superadmin' AND aktiv = true"
  );
  if (aktiveRows[0].anzahl <= 1) {
    throw new Error("Das ist das letzte aktive Superadmin-Konto -- kann nicht deaktiviert werden.");
  }

  const userId = rows[0].id;
  await verbindung.query("UPDATE users SET aktiv = false WHERE id = $1", [userId]);
  // Sofort ungültig, nicht erst beim nächsten Login.
  await verbindung.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  await verbindung.query(
    `INSERT INTO plattform_protokoll (aktion, user_id, ziel_email)
     VALUES ('superadmin_deaktiviert', $1, $2)`,
    [userId, eMail]
  );
}

async function kommandozeile() {
  const rl = readline.createInterface({ input: process.stdin });
  const zeilen = rl[Symbol.asyncIterator]();
  const pool = eigentuemerVerbindung();
  try {
    process.stdout.write("E-Mail-Adresse des zu deaktivierenden Superadmins: ");
    const email = (await zeilen.next()).value ?? "";
    rl.close();

    await deaktiviereSuperadmin(pool, { email });

    console.log("");
    console.log(`Konto deaktiviert: ${email.trim()}`);
    console.log("Alle laufenden Sitzungen dieses Kontos wurden sofort beendet.");
    return 0;
  } catch (err) {
    console.error(`Abbruch: ${err.message}`);
    return 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await kommandozeile();
}
