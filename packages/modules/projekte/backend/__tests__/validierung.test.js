import { test } from "node:test";
import assert from "node:assert/strict";
import { projektFelder, pruefeProjektFelder, pruefePhase } from "../validierung.js";

const CONFIG = {
  projektarten: ["iSFP", "BEG EM"],
  status: [
    { label: "Aktiv" },
    { label: "Pausiert (manuell)", grundPflicht: true },
    { label: "Pausiert (Eskalation)", nurAutomatisch: true },
    { label: "Abgeschlossen", terminal: true },
    { label: "Storniert", terminal: true },
  ],
  phasen: ["Beauftragt", "Datenaufnahme", "Bearbeitung", "Abrechnung", "Abgeschlossen"],
};

function gueltig(ueberschreibungen = {}) {
  return projektFelder({
    name: "Müller – iSFP",
    arten: ["iSFP"],
    status: "Aktiv",
    phase: "Beauftragt",
    ...ueberschreibungen,
  });
}

test("Gültige Felder werden angenommen", () => {
  assert.equal(pruefeProjektFelder(gueltig(), CONFIG), null);
});

test("Ohne Namen gibt es eine Fehlermeldung", () => {
  assert.match(pruefeProjektFelder(gueltig({ name: "   " }), CONFIG), /Projektnamen/);
});

test("Unbekannte Projektart wird abgelehnt", () => {
  assert.match(pruefeProjektFelder(gueltig({ arten: ["Erfundene Art"] }), CONFIG), /Projektart/);
});

test("Mehrfachauswahl: zwei gültige Projektarten gleichzeitig sind erlaubt (Kombi)", () => {
  assert.equal(pruefeProjektFelder(gueltig({ arten: ["iSFP", "BEG EM"] }), CONFIG), null);
});

test("Unbekannter Status wird abgelehnt", () => {
  assert.match(pruefeProjektFelder(gueltig({ status: "Erfunden" }), CONFIG), /Status/);
});

test("'Pausiert (Eskalation)' kann nicht von Hand gesetzt werden", () => {
  assert.match(
    pruefeProjektFelder(gueltig({ status: "Pausiert (Eskalation)" }), CONFIG),
    /nicht von Hand/
  );
});

test("'Pausiert (manuell)' ohne Grund wird abgelehnt", () => {
  assert.match(pruefeProjektFelder(gueltig({ status: "Pausiert (manuell)" }), CONFIG), /Grund/);
});

test("'Pausiert (manuell)' mit Grund ist gültig", () => {
  assert.equal(
    pruefeProjektFelder(gueltig({ status: "Pausiert (manuell)", pausiertGrund: "Wartet auf Kunde" }), CONFIG),
    null
  );
});

test("Unbekannte Phase wird abgelehnt", () => {
  assert.match(pruefeProjektFelder(gueltig({ phase: "Erfunden" }), CONFIG), /Phase/);
});

test("Ablage-Link muss http oder https sein", () => {
  assert.match(pruefeProjektFelder(gueltig({ ablageLink: "javascript:alert(1)" }), CONFIG), /http/);
  assert.match(pruefeProjektFelder(gueltig({ ablageLink: "ftp://server/ordner" }), CONFIG), /http/);
  assert.equal(pruefeProjektFelder(gueltig({ ablageLink: "https://cloud.example.test/ordner" }), CONFIG), null);
  assert.equal(pruefeProjektFelder(gueltig({ ablageLink: "http://cloud.example.test/ordner" }), CONFIG), null);
});

test("pruefePhase: nur konfigurierte Phasen sind gültig", () => {
  assert.equal(pruefePhase("Bearbeitung", CONFIG), null);
  assert.match(pruefePhase("Erfunden", CONFIG), /Phase/);
});

test("Ohne Projektart gibt es eine Fehlermeldung (mindestens eine ist Pflicht)", () => {
  assert.match(pruefeProjektFelder(gueltig({ arten: [] }), CONFIG), /mindestens eine Projektart/);
});

test("PLZ der Objektadresse: genau 5 Ziffern, leer bleibt erlaubt", () => {
  for (const plz of ["1234", "123456", "12a45"]) {
    assert.match(pruefeProjektFelder(gueltig({ objektadressePlz: plz }), CONFIG), /PLZ/);
  }
  assert.equal(pruefeProjektFelder(gueltig({ objektadressePlz: "" }), CONFIG), null);
  assert.equal(pruefeProjektFelder(gueltig({ objektadressePlz: "26122" }), CONFIG), null);
});
