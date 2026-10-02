import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { hashPassword } from "../../auth/password.js";
import {
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

const PASSWORT = "Ein-Sicheres-Passwort-12";
const firma = await erstelleTestfirmaMitRechten("Sicherheit-Header Test");
const emailAdmin = `admin-${firma}@example.test`;

const passwortHash = await hashPassword(PASSWORT);
await withFirma(firma, (client) =>
  client.query(
    "INSERT INTO users (firma_id, email, passwort_hash, name, rolle) VALUES ($1, $2, $3, 'Admin', 'Admin')",
    [firma, emailAdmin, passwortHash]
  )
);

const server = createApp().listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  await loescheTestfirma(firma);
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Sicherheits-Header (helmet) sind auf jeder Antwort dabei", async () => {
  const res = await fetch(`${basis}/api/health`);
  assert.ok(res.headers.get("content-security-policy").includes("default-src 'self'"));
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

test("Content-Security-Policy erlaubt Bilder als Daten-URL (Firmenlogo), aber keine fremden Skripte", async () => {
  const res = await fetch(`${basis}/api/health`);
  const csp = res.headers.get("content-security-policy");
  assert.match(csp, /img-src 'self' data:/);
  assert.match(csp, /script-src 'self'/);
});

test("Rate-Begrenzung meldet ihr Limit über Standard-Header, ohne normale Nutzung zu blockieren", async () => {
  const res = await fetch(`${basis}/api/health`);
  assert.equal(res.status, 200);
  // /api/health ist von der Begrenzung ausgenommen -- an einer anderen Route prüfen.
  const res2 = await fetch(`${basis}/api/auth/me`);
  assert.ok(res2.headers.get("ratelimit-limit"));
});

test("CSRF: Anfrage mit fremdem Origin wird abgelehnt", async () => {
  const res = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://boese-seite.test" },
    body: JSON.stringify({ email: emailAdmin, passwort: PASSWORT }),
  });
  assert.equal(res.status, 403);
});

test("CSRF: Anfrage mit passendem Origin wird nicht blockiert", async () => {
  const res = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: basis },
    body: JSON.stringify({ email: emailAdmin, passwort: "falsches-passwort" }),
  });
  // 401 (falsches Passwort) statt 403 (CSRF) zeigt: die CSRF-Prüfung hat
  // durchgelassen, abgelehnt wurde nur wegen des falschen Passworts.
  assert.equal(res.status, 401);
});

test("CSRF: Sec-Fetch-Site same-origin wird nicht blockiert, cross-site schon", async () => {
  const gleicheSeite = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify({ email: emailAdmin, passwort: "falsches-passwort" }),
  });
  assert.equal(gleicheSeite.status, 401);

  const fremdeSeite = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
    body: JSON.stringify({ email: emailAdmin, passwort: PASSWORT }),
  });
  assert.equal(fremdeSeite.status, 403);
});

test("Cookie ist im Produktivbetrieb 'secure', außerhalb nicht", async () => {
  const vorher = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const prodRes = await fetch(`${basis}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAdmin, passwort: PASSWORT }),
    });
    assert.match(prodRes.headers.get("set-cookie"), /Secure/i);

    process.env.NODE_ENV = "development";
    const devRes = await fetch(`${basis}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAdmin, passwort: PASSWORT }),
    });
    assert.doesNotMatch(devRes.headers.get("set-cookie"), /Secure/i);
  } finally {
    process.env.NODE_ENV = vorher;
  }
});
