import { Router } from "express";
import { WebSource } from "../models/WebSource.js";
import { KBChunk } from "../models/KBChunk.js";
import { crawlSite } from "../services/webCrawler.js";
import { buildKBIndex } from "../services/kbIndex.js";

const router = Router();

router.get("/", async (_req, res) => {
  res.json(await WebSource.findAll({ order: [["createdAt", "DESC"]] }));
});

/** Crawl a URL and chunk each page into the KB by paragraph (website prose isn't Q&A-structured like the KB doc). */
router.post("/", async (req, res) => {
  const { url, pageLimit = 25 } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: "url is required" });

  const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  const source = await WebSource.create({ url: normalizedUrl, pageLimit });

  try {
    const pages = await crawlSite(normalizedUrl, Number(pageLimit) || 25);
    if (pages.length === 0) throw new Error("Could not fetch any page content from that URL");

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
    await source.save();
    await buildKBIndex();
    res.json(source);
  } catch (err) {
    console.error("[webSources] crawl error:", err);
    source.status = "failed";
    source.error = err.message;
    await source.save();
    res.status(500).json({ error: err.message, source });
  }
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

export default router;
