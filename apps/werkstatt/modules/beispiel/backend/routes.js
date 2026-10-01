import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({ nachricht: "Hallo Baustein!" });
});

export default router;
