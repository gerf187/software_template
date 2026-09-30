import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../app.js";

async function nutzerRouteStatus(appName, production) {
  const server = createApp({ appName, production }).listen(0);
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api/werkstatt/nutzer`);
    return res.status;
  } finally {
    server.close();
  }
}

test("Werkstatt-Route existiert in der Werkstatt außerhalb des Produktivbetriebs", async () => {
  assert.equal(await nutzerRouteStatus("werkstatt", false), 200);
});

test("Werkstatt-Route existiert nicht im Produktivbetrieb, selbst in der Werkstatt", async () => {
  assert.equal(await nutzerRouteStatus("werkstatt", true), 404);
});

test("Werkstatt-Route existiert nicht in Energieberater", async () => {
  assert.equal(await nutzerRouteStatus("energieberater", false), 404);
});

test("Werkstatt-Route existiert nicht in Sachverständige", async () => {
  assert.equal(await nutzerRouteStatus("sachverstaendige", false), 404);
});
