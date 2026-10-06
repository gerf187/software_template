import crypto from "node:crypto";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { hashPassword } from "../auth/password.js";

// Kommandozeilen-Befehl, um den ersten (und weitere) Superadmin anzulegen.
// Bewusst KEINE Web-Route: Im Produktivbetrieb gibt es sonst keinen Weg, eine
// Plattform-Rolle anzulegen (Abschnitt 7). Läuft mit dem Eigentümer-Zugang
// (POSTGRES_USER), nicht über die App-Rolle -- wie die Migrationen.
//
// Aufruf auf dem Server (Schritt in der README, "Ersten Superadmin anlegen"). Der
// Dienst "app" hat bewusst kein Eigentümer-Passwort, darum läuft der Befehl im
// Dienst "migrate":
//   docker compose -f docker-compose.prod.yml run --rm -it --entrypoint npm -w /app/packages/core/fundament/backend migrate run superadmin:anlegen

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Legt einen Superadmin ohne Firma an. Gibt das Startpasswort zurück, das nur
// einmal angezeigt wird. Der Nutzer muss es beim ersten Login ändern.
export async function legeSuperadminAn(verbindung, { email, name }) {
  const eMail = (email || "").trim();
  const anzeigeName = (name || "").trim();
  if (!EMAIL_MUSTER.test(eMail)) {
    throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
  }
  if (!anzeigeName) {
    throw new Error("Bitte einen Namen angeben.");
  }

  // 18 Zufallsbytes ergeben 24 Zeichen -- weit über dem Mindestmaß von 12 (Anhang A.4).
  const passwort = crypto.randomBytes(18).toString("base64url");
  const hash = await hashPassword(passwort);

  try {
    await verbindung.query(
      `INSERT INTO users (firma_id, email, passwort_hash, name, rolle, muss_passwort_aendern)
       VALUES (NULL, $1, $2, $3, 'Superadmin', true)`,
      [eMail, hash, anzeigeName]
    );
  } catch (err) {
    if (err.code === "23505") {
      throw new Error(`Es gibt bereits ein Konto mit der E-Mail-Adresse ${eMail}.`);
    }
    throw err;
  }

  return { passwort };
}

function eigentuemerVerbindung() {
  const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } =
    process.env;
  return new pg.Pool({
    connectionString: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
  });
}

async function kommandozeile() {
  // Zeilen über den Iterator lesen, nicht über rl.question(): so gehen auch
  // Eingaben nicht verloren, die schneller kommen als die Fragen (Pipe, Skript).
  const rl = readline.createInterface({ input: process.stdin });
  const zeilen = rl[Symbol.asyncIterator]();
  const pool = eigentuemerVerbindung();
  try {
    process.stdout.write("E-Mail-Adresse des Superadmins: ");
    const email = (await zeilen.next()).value ?? "";
    process.stdout.write("Name: ");
    const name = (await zeilen.next()).value ?? "";
    rl.close();

    const { passwort } = await legeSuperadminAn(pool, { email, name });

    console.log("");
    console.log("Superadmin angelegt.");
    console.log(`E-Mail-Adresse: ${email.trim()}`);
    console.log(`Startpasswort:  ${passwort}`);
    console.log("");
    console.log("Dieses Passwort wird nur jetzt angezeigt. Beim ersten Login muss es geändert werden.");
    return 0;
  } catch (err) {
    console.error(`Abbruch: ${err.message}`);
    return 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

// Nur ausführen, wenn die Datei direkt gestartet wird (nicht beim Import in Tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await kommandozeile();
}
