import { Router } from "express";
import { WebSource } from "../models/WebSource.js";
import { KBChunk } from "../models/KBChunk.js";
import { crawlSite } from "../services/webCrawler.js";
import { buildKBIndex } from "../services/kbIndex.js";

const router = Router();
const running = new Set();

async function ingestWebSource(sourceId) {
  if (running.has(sourceId)) return;
  running.add(sourceId);
  const source = await WebSource.findByPk(sourceId);
  if (!source || source.status === "done") {
    running.delete(sourceId);
    return;
  }
  try {
    const pages = await crawlSite(source.url, Number(source.pageLimit) || 25);
    if (pages.length === 0) throw new Error("Could not fetch any page content from that URL");

    await KBChunk.destroy({ where: { sourceDoc: source.url } });
    for (const page of pages) {
      const paragraphs = page.text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 40);
      for (const content of paragraphs) {
        await KBChunk.create({ sourceDoc: source.url, section: page.title || page.url, type: "prose", content });
      }
    }

    source.status = "done";
    source.pagesFetched = pages.length;
    source.error = null;
    await source.save();
    await buildKBIndex();
  } catch (err) {
    console.error("[webSources] crawl error:", err);
    source.status = "failed";
    source.error = String(err.message || err).slice(0, 480);
    await source.save();
  } finally {
    running.delete(sourceId);
  }
}

router.get("/", async (_req, res) => {
  res.json(await WebSource.findAll({ order: [["createdAt", "DESC"]] }));
});

router.get("/:id", async (req, res) => {
  const source = await WebSource.findByPk(req.params.id);
  if (!source) return res.status(404).json({ error: "not found" });
  res.json(source);
});

/** Start a crawl and return immediately so Nginx cannot 504 mid-fetch. */
router.post("/", async (req, res) => {
  const { url, pageLimit = 25 } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: "url is required" });

  const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  const pending = await WebSource.findOne({ where: { url: normalizedUrl, status: "pending" } });
  if (pending) {
    setImmediate(() => ingestWebSource(pending.id));
    return res.status(202).json(pending);
  }

  const source = await WebSource.create({ url: normalizedUrl, pageLimit, status: "pending" });
  setImmediate(() => ingestWebSource(source.id));
  res.status(202).json(source);
});

router.delete("/:id", async (req, res) => {
  const source = await WebSource.findByPk(req.params.id);
  if (source) {
    await KBChunk.destroy({ where: { sourceDoc: source.url } });
    await source.destroy();
    await buildKBIndex();
  }
  res.json({ ok: true });
});

export async function resumePendingWebSources() {
  const pending = await WebSource.findAll({ where: { status: "pending" } });
  for (const row of pending) setImmediate(() => ingestWebSource(row.id));
}

export default router;
