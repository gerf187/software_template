import { test } from "node:test";
import assert from "node:assert/strict";
import { fehlerBehandlung } from "../../errorHandler.js";

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
}

test("Im Produktivbetrieb enthält die Fehlerantwort keine technischen Details", () => {
  const vorher = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const res = mockRes();
    fehlerBehandlung(new Error("geheime Interna aus der Datenbank"), {}, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, "Es ist ein Fehler aufgetreten.");
    assert.equal(res.body.details, undefined);
  } finally {
    process.env.NODE_ENV = vorher;
  }
});

test("Außerhalb des Produktivbetriebs zeigt die Fehlerantwort die Details (einfacheres Debuggen)", () => {
  const vorher = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const res = mockRes();
    fehlerBehandlung(new Error("Testfehler"), {}, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.details, "Testfehler");
  } finally {
    process.env.NODE_ENV = vorher;
  }
});

test("Sind die Header schon gesendet, wird an next() weitergegeben statt erneut zu antworten", () => {
  const res = { headersSent: true };
  let weitergegeben = false;
  fehlerBehandlung(new Error("zu spät"), {}, res, () => {
    weitergegeben = true;
  });
  assert.equal(weitergegeben, true);
});
