import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { ladeModule } from "../lade.js";

// Gemeinsame Bausteine (packages/modules/) werden nur über Ordner-Fixtures in
// einem temporären Verzeichnis geprüft -- nichts davon landet im Repo.

async function baueOrdner() {
  const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), "modul-test-"));
  const appsOrdner = path.join(wurzel, "apps");
  const gemeinsamerOrdner = path.join(wurzel, "packages", "modules");
  await fs.mkdir(path.join(appsOrdner, "testapp", "modules"), { recursive: true });
  await fs.mkdir(gemeinsamerOrdner, { recursive: true });
  return { wurzel, appsOrdner, gemeinsamerOrdner };
}

async function schreibeBaustein(ordner, name, titel) {
  const dir = path.join(ordner, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "modul.config.js"),
    `export default { titel: ${JSON.stringify(titel)}, braucht: [], menuepunkte: [] };\n`
  );
}

test("Gemeinsamer Baustein wird geladen, wenn die App ihn nicht selbst hat", async () => {
  const o = await baueOrdner();
  try {
    await schreibeBaustein(o.gemeinsamerOrdner, "projekte", "Projekte gemeinsam");
    const ergebnis = await ladeModule({
      namen: ["projekte"],
      app: "testapp",
      appsOrdner: o.appsOrdner,
      gemeinsamerOrdner: o.gemeinsamerOrdner,
    });
    assert.equal(ergebnis.length, 1);
    assert.equal(ergebnis[0].config.titel, "Projekte gemeinsam");
  } finally {
    await fs.rm(o.wurzel, { recursive: true, force: true });
  }
});

test("App-eigener Baustein wird genommen, wenn es ihn nur dort gibt", async () => {
  const o = await baueOrdner();
  try {
    await schreibeBaustein(path.join(o.appsOrdner, "testapp", "modules"), "eigen", "Nur in der App");
    const ergebnis = await ladeModule({
      namen: ["eigen"],
      app: "testapp",
      appsOrdner: o.appsOrdner,
      gemeinsamerOrdner: o.gemeinsamerOrdner,
    });
    assert.equal(ergebnis[0].config.titel, "Nur in der App");
  } finally {
    await fs.rm(o.wurzel, { recursive: true, force: true });
  }
});

test("Gleicher Name in App und gemeinsamen Bausteinen bricht den Start ab", async () => {
  const o = await baueOrdner();
  try {
    await schreibeBaustein(path.join(o.appsOrdner, "testapp", "modules"), "doppelt", "App");
    await schreibeBaustein(o.gemeinsamerOrdner, "doppelt", "Gemeinsam");
    await assert.rejects(
      ladeModule({
        namen: ["doppelt"],
        app: "testapp",
        appsOrdner: o.appsOrdner,
        gemeinsamerOrdner: o.gemeinsamerOrdner,
      }),
      /Namenskonflikt.*doppelt/
    );
  } finally {
    await fs.rm(o.wurzel, { recursive: true, force: true });
  }
});

test("Unbekannter Baustein bricht den Start mit klarer Meldung ab", async () => {
  const o = await baueOrdner();
  try {
    await assert.rejects(
      ladeModule({
        namen: ["gibt-es-nicht"],
        app: "testapp",
        appsOrdner: o.appsOrdner,
        gemeinsamerOrdner: o.gemeinsamerOrdner,
      }),
      /Baustein "gibt-es-nicht" nicht gefunden/
    );
  } finally {
    await fs.rm(o.wurzel, { recursive: true, force: true });
  }
});
