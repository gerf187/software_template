import { Router } from "express";
import { erfordertRecht } from "@fundament/backend/src/rechte/darf.js";

const router = Router();

router.get("/", erfordertRecht("beispiel", "sehen"), (req, res) => {
  res.json({ nachricht: "Hallo Baustein!" });
});

export default router;
