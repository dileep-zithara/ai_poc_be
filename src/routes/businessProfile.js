import { Router } from "express";
import { BusinessProfile } from "../models/BusinessProfile.js";
import { WebSource } from "../models/WebSource.js";
import { KBChunk } from "../models/KBChunk.js";
import { crawlSite, mergeSignals } from "../services/webCrawler.js";
import { hydrateStoreDirectory } from "../services/storeDirectory.js";
import { buildKBIndex } from "../services/kbIndex.js";
import { callLLM } from "../services/llm/index.js";
import { displayWhatsApp } from "../config.js";

const SINGLETON_ID = 1;
const FIELDS = [
  "businessName",
  "location",
  "productsServices",
  "contactInfo",
  "supportHours",
  "policies",
  "website",
  "socialLinks",
  "aiInstructions",
];

const router = Router();

async function getProfile() {
  let row = await BusinessProfile.findByPk(SINGLETON_ID);
  if (!row) row = await BusinessProfile.create({ id: SINGLETON_ID });
  return row;
}

const IMPORT_STALE_MS = 6 * 60 * 1000;
const IDLE_JOB = { status: "idle" };

function parseImportJob(raw) {
  try {
    const job = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (job && typeof job === "object" && job.status) return job;
  } catch {
    // fall through
  }
  return { ...IDLE_JOB };
}

function serialize(row) {
  const prefilledFields = JSON.parse(row.prefilledFields);
  const filledCount = FIELDS.filter((f) => row[f]).length;
  return { ...row.toJSON(), prefilledFields, filledCount, totalFields: FIELDS.length, importJob: parseImportJob(row.importJob) };
}

function isImportRunning(job) {
  if (job?.status !== "running") return false;
  const started = Date.parse(job.startedAt || "");
  return Number.isFinite(started) ? Date.now() - started < IMPORT_STALE_MS : true;
}

async function writeImportJob(row, job) {
  row.importJob = JSON.stringify(job);
  await row.save();
  return job;
}

router.get("/", async (_req, res) => {
  res.json(serialize(await getProfile()));
});

router.put("/", async (req, res) => {
  const row = await getProfile();
  for (const f of FIELDS) if (req.body[f] !== undefined) row[f] = req.body[f];
  if (req.body.confirmed !== undefined) row.confirmed = req.body.confirmed;
  const prefilled = JSON.parse(row.prefilledFields).filter((f) => req.body[f] === undefined);
  row.prefilledFields = JSON.stringify(prefilled);
  await row.save();
  hydrateStoreDirectory(row.toJSON());
  res.json(serialize(row));
});

const EXTRACT_TOOL = {
  name: "extract_business_profile",
  description: "Extract structured business info from crawled website text, high-level brand facts down to store-level detail.",
  input_schema: {
    type: "object",
    properties: {
      businessName: { type: "string", description: "Legal or trading name. Empty string if not found." },
      location: { type: "string", description: "One store per line as City: full address. Empty if not found." },
      productsServices: { type: "string", description: "What they sell, from category (Polki, diamond, gold) down to key collections/occasions." },
      contactInfo: { type: "string", description: "Central WhatsApp/phone plus per-store numbers when listed." },
      supportHours: { type: "string", description: "Store or support hours if stated." },
      policies: { type: "string", description: "Shipping, returns, exchange, buyback, certification — only as written on the site." },
      socialLinks: { type: "string", description: "Instagram, Facebook, YouTube, app links." },
      aiInstructions: { type: "string", description: "Short agent rules grounded only in the site: tone, what not to invent, when to quote a store WhatsApp." },
    },
    required: ["businessName", "location", "productsServices", "contactInfo", "supportHours", "policies", "socialLinks", "aiInstructions"],
  },
};

function pickLonger(current, incoming) {
  if (!incoming) return current || "";
  if (!current) return incoming;
  return incoming.length > current.length ? incoming : current;
}

function heuristicProfile(pages, signals, website) {
  const home = pages.find((p) => new URL(p.url).pathname === "/") || pages[0];
  const title = (home?.title || "").replace(/\s+/g, " ").trim();
  const businessName = signals.ogSite || title.split(/[–|]/).pop()?.trim() || "";

  const cityNames = [...new Set(signals.whatsapp.map((w) => w.city).filter((c) => c && !/chat|click|book|assist/i.test(c)))];
  const waLines = signals.whatsapp.map((row) => {
    const city = row.city ? ` (${row.city})` : "";
    return `${row.phone}${city}`;
  });
  const central = signals.whatsapp.find((row) => !row.city || /query|stylist|video/i.test(row.href || "")) || signals.whatsapp[0];

  const collectionHint = pages
    .filter((p) => /\/collections\//.test(p.url))
    .map((p) => decodeURIComponent(new URL(p.url).pathname.replace("/collections/", "").replace(/-/g, " ")))
    .filter((name) => !/store|ready to ship/i.test(name))
    .slice(0, 24);

  const policyPages = pages.filter((p) => /shipping|terms|privacy|faq|certification|know-your-polki|about/i.test(p.url));
  const policyText = policyPages
    .map((p) => `## ${p.title || p.url}\n${p.text.slice(0, 2500)}`)
    .join("\n\n")
    .slice(0, 8000);

  const hoursMatch = pages.map((p) => p.text).join("\n").match(/(?:open|hours|timing)[^\n]{0,80}\d{1,2}\s*(?:am|pm|:)/i);

  return {
    businessName,
    location: cityNames.length ? cityNames.map((city) => `${city}:`).join("\n") : "",
    productsServices: [
      title,
      collectionHint.length ? `Collections on the site: ${collectionHint.join(", ")}` : "",
    ].filter(Boolean).join("\n\n"),
    contactInfo: [
      `Central WhatsApp: ${central?.phone || displayWhatsApp()}`,
      signals.emails.length ? `Email: ${signals.emails.join(", ")}` : "",
      waLines.length ? `Store WhatsApp:\n${[...new Set(waLines)].join("\n")}` : "",
    ].filter(Boolean).join("\n"),
    supportHours: hoursMatch ? hoursMatch[0].replace(/\s+/g, " ").trim() : "",
    policies: policyText,
    website,
    socialLinks: [...signals.social, ...signals.emails].join("\n"),
    aiInstructions: businessName
      ? `You represent ${businessName} (${website}). Use catalog prices; do not invent SKUs or discounts. For store visits, quote the WhatsApp number for the customer's city when known, otherwise Central WhatsApp ${displayWhatsApp()}. Only state shipping, returns, exchange, or buyback as written in the indexed policies.`
      : "",
  };
}

function pagesForModel(pages) {
  const ranked = [...pages].sort((a, b) => (b.score || 0) - (a.score || 0));
  const chunks = [];
  let used = 0;
  const budget = 70_000;
  for (const page of ranked) {
    const slice = page.score >= 80 ? 8000 : page.score >= 50 ? 4000 : 1800;
    const block = `# ${page.title || page.url}\nURL: ${page.url}\n${page.text.slice(0, slice)}`;
    if (used + block.length > budget) break;
    chunks.push(block);
    used += block.length;
  }
  return chunks.join("\n\n");
}

async function indexPagesForKb(url, pages) {
  const existing = await WebSource.findOne({ where: { url } });
  const source = existing || await WebSource.create({ url, pageLimit: pages.length });
  if (existing) {
    await KBChunk.destroy({ where: { sourceDoc: url } });
  }
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
  source.pageLimit = pages.length;
  source.pagesFetched = pages.length;
  source.error = null;
  await source.save();
  await buildKBIndex();
}

async function runWebsiteImport(normalizedUrl, pageLimit) {
  const row = await getProfile();
  const job = parseImportJob(row.importJob);
  try {
    const pages = await crawlSite(normalizedUrl, pageLimit, async ({ pagesFetched }) => {
      const latest = await getProfile();
      const current = parseImportJob(latest.importJob);
      if (current.status !== "running") return;
      await writeImportJob(latest, { ...current, pagesFetched });
    });
    if (pages.length === 0) throw new Error("Could not fetch any page content from that URL");

    const signals = mergeSignals(pages);
    const heuristics = heuristicProfile(pages, signals, normalizedUrl);
    const combinedText = pagesForModel(pages);

    let extracted = null;
    let usedLLM = false;
    try {
      extracted = await callLLM({
        systemPrompt:
          "Extract business profile facts from the provided website text. Go from high-level brand facts to store-level detail. Only use what is stated; leave a field as an empty string if it is not there. Never invent prices, SKUs, or policy terms.",
        tool: EXTRACT_TOOL,
        messages: [{ role: "user", content: combinedText }],
      });
      usedLLM = true;
    } catch (err) {
      console.warn("[businessProfile] LLM extraction unavailable, using heuristic import:", err.message);
    }

    const merged = { ...heuristics };
    if (extracted) {
      for (const key of Object.keys(heuristics)) {
        if (key === "contactInfo" || key === "socialLinks") {
          merged[key] = pickLonger(extracted[key], heuristics[key]);
        } else if (extracted[key]) {
          merged[key] = extracted[key];
        }
      }
    }

    const latest = await getProfile();
    latest.website = normalizedUrl;
    const newlyPrefilled = [];
    for (const key of FIELDS) {
      if (key === "website") {
        latest.website = normalizedUrl;
        newlyPrefilled.push("website");
        continue;
      }
      if (merged[key]) {
        latest[key] = merged[key];
        newlyPrefilled.push(key);
      }
    }
    const prefilled = new Set([...JSON.parse(latest.prefilledFields), ...newlyPrefilled]);
    latest.prefilledFields = JSON.stringify([...prefilled]);

    try {
      await indexPagesForKb(normalizedUrl, pages);
    } catch (err) {
      console.warn("[businessProfile] KB indexing after import failed:", err.message);
    }

    const pageSummaries = pages.map((p) => ({ url: p.url, title: p.title, score: p.score }));
    await writeImportJob(latest, {
      ...job,
      status: "done",
      pagesFetched: pages.length,
      usedLLM,
      pages: pageSummaries,
      error: null,
      finishedAt: new Date().toISOString(),
    });
    hydrateStoreDirectory(latest.toJSON());
  } catch (err) {
    console.error("[businessProfile import] error:", err);
    const latest = await getProfile();
    await writeImportJob(latest, {
      ...parseImportJob(latest.importJob),
      status: "failed",
      error: err.message,
      finishedAt: new Date().toISOString(),
    });
  }
}

router.post("/import-from-website", async (req, res) => {
  const { url, pageLimit = 25 } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: "url is required" });
  const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  const limit = Number(pageLimit) || 25;

  try {
    const row = await getProfile();
    const current = parseImportJob(row.importJob);
    if (isImportRunning(current)) {
      return res.status(202).json({ status: "running", profile: serialize(row) });
    }

    row.website = normalizedUrl;
    const job = {
      status: "running",
      url: normalizedUrl,
      pageLimit: limit,
      startedAt: new Date().toISOString(),
      pagesFetched: 0,
      usedLLM: false,
      pages: [],
      error: null,
    };
    await writeImportJob(row, job);
    res.status(202).json({ status: "running", profile: serialize(row) });
    runWebsiteImport(normalizedUrl, limit).catch((err) => {
      console.error("[businessProfile import] background error:", err);
    });
  } catch (err) {
    console.error("[businessProfile import] error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
