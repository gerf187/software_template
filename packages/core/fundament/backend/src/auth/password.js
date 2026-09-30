import bcrypt from "bcrypt";

const BCRYPT_COST = 12;
const MIN_LENGTH = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function isTrivial(pw) {
  if (/^(.)\1+$/.test(pw)) return true;

  const codes = [...pw].map((c) => c.charCodeAt(0));
  const aufsteigend = codes.every((c, i) => i === 0 || c === codes[i - 1] + 1);
  const absteigend = codes.every((c, i) => i === 0 || c === codes[i - 1] - 1);
  if (aufsteigend || absteigend) return true;

  const bekannt = ["password", "passwort", "qwertzuiop", "qwertyuiop", "abcdefghijk"];
  return bekannt.some((w) => pw.toLowerCase().includes(w));
}

// Gibt eine Liste von Fehlertexten zurück, leer = Passwort ist ok.
export function pruefePasswort(passwort, email) {
  const fehler = [];
  if (!passwort || passwort.length < MIN_LENGTH) {
    fehler.push(`Das Passwort muss mindestens ${MIN_LENGTH} Zeichen lang sein.`);
  }
  if (email && passwort && passwort.toLowerCase() === email.toLowerCase()) {
    fehler.push("Das Passwort darf nicht die E-Mail-Adresse sein.");
  }
  if (passwort && isTrivial(passwort)) {
    fehler.push("Dieses Passwort ist zu einfach zu erraten.");
  }
  return fehler;
}
