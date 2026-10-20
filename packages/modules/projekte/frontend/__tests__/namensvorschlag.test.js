import { test } from "node:test";
import assert from "node:assert/strict";
import { vorschlagProjektname } from "../namensvorschlag.js";

test("Beispiel aus der Vorgabe: Nachname – Arten – Ort", () => {
  assert.equal(
    vorschlagProjektname({
      kontakt: { nachname: "Müller" },
      arten: ["iSFP", "BEG EM"],
      objektadresseOrt: "Oldenburg",
    }),
    "Müller – iSFP + BEG EM – Oldenburg"
  );
});

test("Organisation hat Vorrang vor Nachname", () => {
  assert.equal(
    vorschlagProjektname({
      kontakt: { nachname: "Müller", organisation: "Müller GmbH" },
      arten: ["iSFP"],
      objektadresseOrt: "Bremen",
    }),
    "Müller GmbH – iSFP – Bremen"
  );
});

test("Ohne Ort fehlt der letzte Teil, kein hängender Trenner", () => {
  assert.equal(
    vorschlagProjektname({ kontakt: { nachname: "Müller" }, arten: ["iSFP"], objektadresseOrt: "" }),
    "Müller – iSFP"
  );
});

test("Ohne Projektart bleibt nur Name und Ort", () => {
  assert.equal(
    vorschlagProjektname({ kontakt: { nachname: "Müller" }, arten: [], objektadresseOrt: "Bremen" }),
    "Müller – Bremen"
  );
});

test("Ohne Kontakt und ohne alles: leerer Vorschlag, kein Absturz", () => {
  assert.equal(vorschlagProjektname({ kontakt: null, arten: [], objektadresseOrt: "" }), "");
});
