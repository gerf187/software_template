import { test } from "node:test";
import assert from "node:assert/strict";
import { fehlendeAbhaengigkeiten } from "../abhaengigkeiten.js";

test("ohne Abhängigkeiten gibt es nichts, was fehlt", () => {
  assert.deepEqual(fehlendeAbhaengigkeiten([], new Set()), []);
  assert.deepEqual(fehlendeAbhaengigkeiten(undefined, new Set()), []);
});

test("erfüllte Abhängigkeit fehlt nicht", () => {
  assert.deepEqual(fehlendeAbhaengigkeiten(["projekte"], new Set(["projekte"])), []);
});

test("nicht aktive Abhängigkeit wird gemeldet", () => {
  assert.deepEqual(fehlendeAbhaengigkeiten(["projekte", "zeiterfassung"], new Set(["projekte"])), [
    "zeiterfassung",
  ]);
});
