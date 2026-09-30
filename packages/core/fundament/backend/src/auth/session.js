import crypto from "node:crypto";

export const SESSION_COOKIE = "session";
export const SESSION_DAUER_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage, gleitend

export function neuesToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
