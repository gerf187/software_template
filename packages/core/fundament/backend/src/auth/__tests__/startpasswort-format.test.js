import { test } from "node:test";
import assert from "node:assert/strict";
import { erzeugeStartpasswort } from "../startpasswort.js";
import { pruefePasswort } from "../password.js";

// Startpasswörter werden abgetippt. Darum ohne 0/O, 1/l/I und in Vierer-Blöcken:
// z. B. 6Gvj-66Sx-27Rg-uA83 (4 Blöcke, Bindestrich dazwischen).

const FORMAT = /^[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}(-[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}){3}$/;

test("Startpasswort: Format Vierer-Blöcke ohne verwechselbare Zeichen (300 Stück)", () => {
  for (let i = 0; i < 300; i++) {
    const pw = erzeugeStartpasswort();
    assert.match(pw, FORMAT, `ungültiges Format: ${pw}`);
    assert.deepEqual(pruefePasswort(pw, "x@example.test"), [], `Regel verletzt: ${pw}`);
  }
});
