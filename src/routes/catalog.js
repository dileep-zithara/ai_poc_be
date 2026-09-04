import { Router } from "express";
import { listAdSets, pingZitharaProd, searchCatalogProducts, searchLiveAds, zitharaProdConfigured } from "../services/zitharaProd.js";

const router = Router();

router.get("/status", async (_req, res) => {
  if (!zitharaProdConfigured()) {
    return res.json({ configured: false, ok: false, hint: "Set ZITHARA_PROD_DATABASE_URL in backend/.env" });
  }
  res.json(await pingZitharaProd());
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "q is required" });
  if (!zitharaProdConfigured()) return res.status(503).json({ error: "zithara_prod is not configured" });
  try {
    res.json({ items: await searchCatalogProducts(q, 12) });
  } catch (err) {
    console.error("[catalog] search failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/adsets", async (req, res) => {
  if (!zitharaProdConfigured()) return res.status(503).json({ error: "zithara_prod is not configured" });
  try {
    res.json({ items: await listAdSets(req.query.q || "") });
  } catch (err) {
    console.error("[catalog] adsets failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/ads", async (req, res) => {
  if (!zitharaProdConfigured()) return res.status(503).json({ error: "zithara_prod is not configured" });
  try {
    const adSetIds = String(req.query.adSetIds || "").split(",").map((id) => id.trim()).filter(Boolean);
    res.json({ items: await searchLiveAds({ query: req.query.q || "", adSetIds, limit: req.query.limit }) });
  } catch (err) {
    console.error("[catalog] ads failed:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
