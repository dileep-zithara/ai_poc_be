import { Router } from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { ingestDocx } from "../services/ingestDocx.js";
import { buildKBIndex } from "../services/kbIndex.js";
import { KBChunk } from "../models/KBChunk.js";

const upload = multer({ dest: os.tmpdir() });
const router = Router();

/** Upload a .docx and ingest it into the KB — this is what should replace
 *  most manual onboarding questions: if the business already has a
 *  document covering shipping/returns/etc., extract from it instead of
 *  asking the same thing in a form field. */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const label = req.body.label || req.file.originalname;

    const chunkCount = await ingestDocx(req.file.path, label);
    await buildKBIndex();
    await fs.unlink(req.file.path);

    res.json({ ok: true, sourceDoc: label, chunkCount });
  } catch (err) {
    console.error("[documents upload] error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** List ingested documents and a rough coverage summary (which sections
 *  exist), so the onboarding UI can show "already covered by <doc>"
 *  instead of asking again. */
router.get("/", async (_req, res) => {
  const chunks = await KBChunk.findAll();
  const bySource = {};
  for (const c of chunks) {
    bySource[c.sourceDoc] ??= { sourceDoc: c.sourceDoc, chunkCount: 0, sections: new Set() };
    bySource[c.sourceDoc].chunkCount += 1;
    bySource[c.sourceDoc].sections.add(c.section);
  }
  res.json(
    Object.values(bySource).map((d) => ({ ...d, sections: [...d.sections] }))
  );
});

export default router;
