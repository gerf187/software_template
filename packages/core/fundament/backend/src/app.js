import express from "express";
import { pool } from "./db/pool.js";
import authRoutes from "./auth/routes.js";
import werkstattRoutes from "./werkstatt/routes.js";
import rechteRoutes from "./rechte/routes.js";
import kontakteRoutes from "./kontakte/routes.js";
import mitarbeiterRoutes from "./mitarbeiter/routes.js";
import firmaRoutes from "./firma/routes.js";
import sucheRoutes from "./suche/routes.js";
import dashboardRoutes from "./dashboard/routes.js";
import superadminRoutes from "./superadmin/routes.js";
import { requireAuth } from "./auth/middleware.js";
import { ladeModule } from "./module/lade.js";
import { erfordertModul } from "./module/firmaModule.js";

// Einmal pro Prozess geladen (welche Bausteine diese App anbietet, Abschnitt 8) --
// nicht abhängig vom appName-Override unten, der nur für den Werkstatt-Test-Gate gilt.
const geladeneModule = await ladeModule();

// Als Funktion statt fester Instanz, damit Tests mehrere Varianten (andere
// App, Produktivbetrieb ja/nein) im selben Lauf vergleichen können.
export function createApp({
  appName = process.env.APP_NAME,
  production = process.env.NODE_ENV === "production",
} = {}) {
  const app = express();

  // Grenze über dem Logo-Limit (firma/routes.js, ~280 KB Daten-URL), damit
  // Express selbst nicht schon vorher mit einem rohen 413 abbricht, bevor
  // die eigene, verständliche Fehlermeldung greifen kann.
  app.use(express.json({ limit: "500kb" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/rechte", rechteRoutes);
  app.use("/api/kontakte", kontakteRoutes);
  app.use("/api/mitarbeiter", mitarbeiterRoutes);
  app.use("/api/firma", firmaRoutes);
  app.use("/api/suche", sucheRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/superadmin", superadminRoutes);

  // Nicht freigeschaltete Bausteine gibt es für diese Firma per API nicht
  // (404, nicht 403) -- Abschnitt 8, Regel 3.
  for (const { name, router } of geladeneModule) {
    if (router) {
      app.use(`/api/module/${name}`, requireAuth, erfordertModul(name), router);
    }
  }

  // Der Rollen-Umschalter existiert nur in der Werkstatt und nie im
  // Produktivbetrieb -- sonst wird die Route gar nicht erst registriert,
  // nicht nur "versteckt" oder abgelehnt.
  if (appName === "werkstatt" && !production) {
    app.use("/api/werkstatt", werkstattRoutes);
  }

  app.get("/api/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", datenbank: "ok" });
    } catch (err) {
      res.status(503).json({ status: "ok", datenbank: "fehler" });
    }
  });

  return app;
}
