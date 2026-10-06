import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../app.js";
import { pool } from "../../db/pool.js";

// Gebautes Frontend als Ordner nachbauen: Startseite, ein Bundle, eine Schrift.
const ordner = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-test-"));
fs.writeFileSync(path.join(ordner, "index.html"), "<!doctype html><title>Test</title><div id=root></div>");
fs.mkdirSync(path.join(ordner, "assets"));
fs.writeFileSync(path.join(ordner, "assets", "app.js"), "console.log('ok');");
fs.mkdirSync(path.join(ordner, "fonts"));
fs.writeFileSync(path.join(ordner, "fonts", "Inter-Variable.woff2"), "x");

const server = createApp({ frontendOrdner: ordner }).listen(0);
const basis = `http://localhost:${server.address().port}`;

after(async () => {
  server.close();
  fs.rmSync(ordner, { recursive: true, force: true });
  await pool.end();
});

test("Startseite (/) liefert index.html aus", async () => {
  const res = await fetch(`${basis}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.match(await res.text(), /id=root/);
});

test("Seitenwechsel ohne Datei (z. B. /kontakte/12) fallen auf index.html zurück", async () => {
  const res = await fetch(`${basis}/kontakte/12`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /id=root/);
});

test("Bundles und Schriften werden als Dateien mit richtigem Typ ausgeliefert", async () => {
  const js = await fetch(`${basis}/assets/app.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get("content-type"), /javascript/);

  const font = await fetch(`${basis}/fonts/Inter-Variable.woff2`);
  assert.equal(font.status, 200);
  assert.equal(font.headers.get("content-type"), "font/woff2");
});

test("Unbekannte /api-Adressen bekommen keine index.html, sondern 404", async () => {
  const res = await fetch(`${basis}/api/gibt-es-nicht`);
  assert.equal(res.status, 404);
  assert.doesNotMatch(await res.text(), /id=root/);
});

test("Ohne Frontend-Ordner wird nichts ausgeliefert (Dev-Betrieb)", async () => {
  const ohne = createApp({ frontendOrdner: undefined }).listen(0);
  try {
    const res = await fetch(`http://localhost:${ohne.address().port}/`);
    assert.equal(res.status, 404);
  } finally {
    ohne.close();
  }
});

test("Sicherheits-Header auf der Startseite: CSP, HSTS, Frame-Schutz, Referrer", async () => {
  const res = await fetch(`${basis}/`);
  assert.match(res.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(res.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(res.headers.get("strict-transport-security"), /max-age=\d+/);
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("referrer-policy"), "same-origin");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});
