import { Router } from "express";
import { AdContext } from "../models/AdContext.js";

const router = Router();

router.get("/", async (_req, res) => {
  res.json(await AdContext.findAll({ order: [["createdAt", "DESC"]] }));
});

router.post("/", async (req, res) => {
  const { adId, cardId, label, productName, productPrice, productWeight, productNotes, instructions } = req.body;
  if (!adId) return res.status(400).json({ error: "adId is required" });
  const resolvedLabel = String(label || productName || adId).trim();
  const fields = { label: resolvedLabel, productName, productPrice, productWeight, productNotes, instructions };
  const existing = await AdContext.findOne({ where: cardId ? { adId, cardId } : { adId } });
  if (existing) {
    await existing.update(fields);
    return res.json(existing);
  }
  res.json(await AdContext.create({ adId, cardId, ...fields }));
});

router.delete("/:id", async (req, res) => {
  await AdContext.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/** Looked up by the chat route when a conversation starts from a known ad. */
export async function findAdContext(adId, cardId) {
  return AdContext.findOne({ where: cardId ? { adId, cardId } : { adId } });
}

export default router;
