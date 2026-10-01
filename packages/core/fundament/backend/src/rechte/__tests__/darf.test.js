import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../db/pool.js";
import { withFirma } from "../../db/withFirma.js";
import { darf } from "../darf.js";
import {
  erstelleTestfirmaMitRechten,
  loescheTestfirma,
  schliesseTestVerbindungen,
} from "../../db/__tests__/helpers.js";

const firmaA = await erstelleTestfirmaMitRechten("Rechte Test A");
const firmaB = await erstelleTestfirmaMitRechten("Rechte Test B");

after(async () => {
  await loescheTestfirma(firmaA);
  await loescheTestfirma(firmaB);
  await schliesseTestVerbindungen();
  await pool.end();
});

test("Admin darf in seiner Firma Kontakte sehen, bearbeiten und löschen", async () => {
  const user = { firmaId: firmaA, rolle: "Admin" };
  assert.equal(await darf(user, "kontakte", "sehen"), true);
  assert.equal(await darf(user, "kontakte", "bearbeiten"), true);
  assert.equal(await darf(user, "kontakte", "loeschen"), true);
});

test("Mitarbeiter darf Kontakte sehen und bearbeiten, aber nicht löschen", async () => {
  const user = { firmaId: firmaA, rolle: "Mitarbeiter" };
  assert.equal(await darf(user, "kontakte", "sehen"), true);
  assert.equal(await darf(user, "kontakte", "bearbeiten"), true);
  assert.equal(await darf(user, "kontakte", "loeschen"), false);
});

test("Betrachter darf Kontakte nur sehen, nicht bearbeiten oder löschen", async () => {
  const user = { firmaId: firmaA, rolle: "Betrachter" };
  assert.equal(await darf(user, "kontakte", "sehen"), true);
  assert.equal(await darf(user, "kontakte", "bearbeiten"), false);
  assert.equal(await darf(user, "kontakte", "loeschen"), false);
});

test("Superadmin (keine Firma) hat nie Fach-Rechte", async () => {
  const user = { firmaId: null, rolle: "Superadmin" };
  assert.equal(await darf(user, "kontakte", "sehen"), false);
});

test("Unbekannter Bereich: keine Berechtigung statt Absturz", async () => {
  const user = { firmaId: firmaA, rolle: "Admin" };
  assert.equal(await darf(user, "unbekannter-bereich", "sehen"), false);
});

test("Rechte einer Firma wirken nicht auf eine andere Firma", async () => {
  await withFirma(firmaB, (client) =>
    client.query(
      "UPDATE rechte SET loeschen = true WHERE firma_id = $1 AND rolle = 'Mitarbeiter' AND bereich = 'kontakte'",
      [firmaB]
    )
  );

  const mitarbeiterA = { firmaId: firmaA, rolle: "Mitarbeiter" };
  const mitarbeiterB = { firmaId: firmaB, rolle: "Mitarbeiter" };
  assert.equal(await darf(mitarbeiterA, "kontakte", "loeschen"), false);
  assert.equal(await darf(mitarbeiterB, "kontakte", "loeschen"), true);
});
