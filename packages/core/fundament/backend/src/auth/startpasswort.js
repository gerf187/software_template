import crypto from "node:crypto";

// Startpasswort für Einladungen und Superadmin-Konten. Es wird abgetippt, darum
// ohne leicht verwechselbare Zeichen (0/O, 1/l/I) und in Vierer-Blöcken:
// z. B. 6Gvj-66Sx-27Rg-uA83. 16 Zeichen, weit über dem Mindestmaß von 12 (Anhang A.4).
const ZEICHEN = "abcdefghijkmnpqrstuvwxyz" + "ABCDEFGHJKLMNPQRSTUVWXYZ" + "23456789";

export function erzeugeStartpasswort() {
  const bloecke = [];
  for (let b = 0; b < 4; b++) {
    let block = "";
    for (let i = 0; i < 4; i++) {
      block += ZEICHEN[crypto.randomInt(ZEICHEN.length)];
    }
    bloecke.push(block);
  }
  return bloecke.join("-");
}
