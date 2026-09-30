import express from "express";
import { pool } from "./db/pool.js";

const app = express();
const port = process.env.PORT || 3001;

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", datenbank: "ok" });
  } catch (err) {
    res.status(503).json({ status: "ok", datenbank: "fehler" });
  }
});

app.listen(port, () => {
  console.log(`Backend läuft auf http://localhost:${port}`);
});
