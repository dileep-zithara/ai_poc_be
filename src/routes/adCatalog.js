import { Router } from "express";
import multer from "multer";
import fs from "fs/promises";
import os from "os";
import { AdCatalogEntry } from "../models/AdCatalogEntry.js";

const upload = multer({ dest: os.tmpdir() });
const router = Router();

/** Upload the Meta ad performance export (JSON array) — same shape as the merchant's ads dashboard export. Upserts by ad_id. */
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const raw = await fs.readFile(req.file.path, "utf-8");
    await fs.unlink(req.file.path);

    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return res.status(400).json({ error: "Expected a JSON array of ad records" });

    let imported = 0;
    for (const row of rows) {
      if (!row.ad_id) continue;
      await AdCatalogEntry.upsert({
        adId: String(row.ad_id),
        name: row.name || null,
        adsetName: row.adset_name || null,
        campaignId: row.ad_campaign_id || null,
        creativeId: row.ad_creative_id || null,
        status: row.effective_status || row.status || null,
        spend: typeof row.spend === "number" ? row.spend : null,
        roas: typeof row.roas === "number" ? row.roas : null,
        rawData: row,
      });
      imported += 1;
    }

    res.json({ ok: true, imported, total: rows.length });
  } catch (err) {
    console.error("[adCatalog import] error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** Search imported ads by name or ad ID, for the Ad Source Context picker. */
router.get("/", async (req, res) => {
  const { q = "", offset = "0", limit = "25" } = req.query;
  const { Op } = await import("sequelize");
  const where = q.trim()
    ? { [Op.or]: [{ name: { [Op.like]: `%${q}%` } }, { adId: { [Op.like]: `%${q}%` } }] }
    : {};
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const result = await AdCatalogEntry.findAndCountAll({
    where,
    order: [["spend", "DESC"]],
    offset: Math.max(Number(offset) || 0, 0),
    limit: safeLimit,
  });
  res.json({ items: result.rows, total: result.count, nextOffset: Number(offset) + result.rows.length });
});

router.get("/count", async (_req, res) => {
  res.json({ count: await AdCatalogEntry.count() });
});

router.get("/:adId", async (req, res) => {
  const entry = await AdCatalogEntry.findOne({ where: { adId: req.params.adId } });
  if (!entry) return res.status(404).json({ error: "Ad not found" });
  res.json(entry);
});

export default router;
