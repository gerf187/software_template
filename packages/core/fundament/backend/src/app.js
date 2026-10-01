import express from "express";
import { pool } from "./db/pool.js";
import authRoutes from "./auth/routes.js";
import werkstattRoutes from "./werkstatt/routes.js";
import rechteRoutes from "./rechte/routes.js";

// Als Funktion statt fester Instanz, damit Tests mehrere Varianten (andere
// App, Produktivbetrieb ja/nein) im selben Lauf vergleichen können.
export function createApp({
  appName = process.env.APP_NAME,
  production = process.env.NODE_ENV === "production",
} = {}) {
  const app = express();

  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/rechte", rechteRoutes);

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
