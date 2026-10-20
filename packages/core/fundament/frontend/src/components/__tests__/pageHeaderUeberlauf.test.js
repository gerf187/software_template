import { test } from "node:test";
import assert from "node:assert/strict";
import { sichtbareNebenaktionen } from "../pageHeaderUeberlauf.js";

test("Alles passt: kein Menü nötig, alle Knöpfe bleiben sichtbar", () => {
  const anzahl = sichtbareNebenaktionen({
    verfuegbar: 500,
    breiten: [100, 120, 90],
    mehrKnopfBreite: 44,
    luecke: 8,
  });
  assert.equal(anzahl, 3);
});

test("Nichts passt mehr: nur noch das Menü, alle Knöpfe wandern hinein", () => {
  const anzahl = sichtbareNebenaktionen({
    verfuegbar: 50,
    breiten: [100, 120, 90],
    mehrKnopfBreite: 44,
    luecke: 8,
  });
  assert.equal(anzahl, 0);
});

test("Genau der erste Knopf passt noch neben das Menü, der Rest wandert hinein", () => {
  // Platz für Knopf + Menü: 200 - 44 = 156. Erster Knopf 100 + Lücke 8 = 108 <= 156.
  // Zweiter Knopf dazu: 108 + 120 + 8 = 236 > 156 -> stoppt bei 1.
  const anzahl = sichtbareNebenaktionen({
    verfuegbar: 200,
    breiten: [100, 120, 90],
    mehrKnopfBreite: 44,
    luecke: 8,
  });
  assert.equal(anzahl, 1);
});

test("Bei 'passt genau' (Gleichstand) bleibt der Knopf sichtbar, nichts wird abgeschnitten", () => {
  // Ohne Menü: 100 + 8 + 120 = 228, passt exakt in 228.
  const anzahl = sichtbareNebenaktionen({
    verfuegbar: 228,
    breiten: [100, 120],
    mehrKnopfBreite: 44,
    luecke: 8,
  });
  assert.equal(anzahl, 2);
});

test("Keine Nebenaktionen: null Knöpfe, kein Menü", () => {
  const anzahl = sichtbareNebenaktionen({ verfuegbar: 300, breiten: [], mehrKnopfBreite: 44, luecke: 8 });
  assert.equal(anzahl, 0);
});
