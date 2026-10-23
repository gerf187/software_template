import { erzeugeStartpasswort } from "../auth/startpasswort.js";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../auth/password.js";
import { eigentuemerVerbindung } from "./eigentuemerVerbindung.js";

// Kommandozeilen-Befehl für den Fall, dass ein Superadmin sein Passwort
// verloren hat (Abschnitt 7: Superadmin-Zugang gibt es nie über die Website,
// nur über den Server). Setzt ein neues Startpasswort, beendet alle
// Sitzungen des Kontos sofort und setzt dessen Login-Fehlversuche zurück.
export async function setzeSuperadminPasswortZurueck(verbindung, { email }) {
  const eMail = (email || "").trim();
  if (!eMail) {
    throw new Error("Bitte eine E-Mail-Adresse angeben.");
  }

  const { rows } = await verbindung.query(
    "SELECT id FROM users WHERE lower(email) = lower($1) AND rolle = 'Superadmin'",
    [eMail]
  );
  if (!rows[0]) {
    throw new Error(`Kein Superadmin-Konto mit der E-Mail-Adresse ${eMail} gefunden.`);
  }
  const userId = rows[0].id;

  const passwort = erzeugeStartpasswort();
  const hash = await hashPassword(passwort);

  await verbindung.query(
    "UPDATE users SET passwort_hash = $2, muss_passwort_aendern = true WHERE id = $1",
    [userId, hash]
  );
  // Sofort ungültig, nicht erst beim nächsten Login (wie beim Sperren einer Firma).
  await verbindung.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  await verbindung.query(
    "DELETE FROM login_versuche WHERE lower(email) = lower($1) AND erfolgreich = false",
    [eMail]
  );
  await verbindung.query(
    `INSERT INTO plattform_protokoll (aktion, user_id, ziel_email)
     VALUES ('superadmin_passwort_zuruecksetzen', $1, $2)`,
    [userId, eMail]
  );

  return { passwort };
}

async function kommandozeile() {
  const rl = readline.createInterface({ input: process.stdin });
  const zeilen = rl[Symbol.asyncIterator]();
  const pool = eigentuemerVerbindung();
  try {
    process.stdout.write("E-Mail-Adresse des Superadmins, dessen Passwort zurückgesetzt wird: ");
    const email = (await zeilen.next()).value ?? "";
    rl.close();

    const { passwort } = await setzeSuperadminPasswortZurueck(pool, { email });

    console.log("");
    console.log("Passwort zurückgesetzt.");
    console.log(`E-Mail-Adresse: ${email.trim()}`);
    console.log(`Startpasswort:  ${passwort}`);
    console.log("");
    console.log(
      "Dieses Passwort wird nur jetzt angezeigt. Beim nächsten Login muss es geändert werden. " +
        "Alle laufenden Sitzungen dieses Kontos wurden sofort beendet."
    );
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
