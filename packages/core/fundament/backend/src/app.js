import express from "express";
import { pool } from "./db/pool.js";
import authRoutes from "./auth/routes.js";

export const app = express();

app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", datenbank: "ok" });
  } catch (err) {
    res.status(503).json({ status: "ok", datenbank: "fehler" });
  }
});
