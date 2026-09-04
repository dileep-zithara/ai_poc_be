import { Router } from "express";
import { BusinessProfile } from "../models/BusinessProfile.js";
import { crawlSite, mergeSignals } from "../services/webCrawler.js";
import { callLLM } from "../services/llm/index.js";

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

function serialize(row) {
  const prefilledFields = JSON.parse(row.prefilledFields);
  const filledCount = FIELDS.filter((f) => row[f]).length;
  return { ...row.toJSON(), prefilledFields, filledCount, totalFields: FIELDS.length };
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
  res.json(serialize(row));
});

const EXTRACT_TOOL = {
  name: "extract_business_profile",
  description: "Extract structured business info from crawled website text, high-level brand facts down to store-level detail.",
  input_schema: {
    type: "object",
    properties: {
      businessName: { type: "string", description: "Legal or trading name. Empty string if not found." },
      location: { type: "string", description: "All store cities and addresses, grouped by city. Empty if not found." },
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
  const businessName = signals.ogSite || (title.includes("Tyaani") ? "Tyaani Jewellery Private Limited" : title.split("–").pop()?.trim()) || "";

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
    location: cityNames.length ? `Tyaani stores: ${cityNames.join(", ")}` : "",
    productsServices: [
      title,
      collectionHint.length ? `Collections on the site: ${collectionHint.join(", ")}` : "",
    ].filter(Boolean).join("\n\n"),
    contactInfo: [
      central ? `Central WhatsApp: ${central.phone}` : "",
      signals.emails.length ? `Email: ${signals.emails.join(", ")}` : "",
      waLines.length ? `Store WhatsApp:\n${[...new Set(waLines)].join("\n")}` : "",
    ].filter(Boolean).join("\n"),
    supportHours: hoursMatch ? hoursMatch[0].replace(/\s+/g, " ").trim() : "",
    policies: policyText,
    website,
    socialLinks: [...signals.social, ...signals.emails].join("\n"),
    aiInstructions: businessName
      ? `You represent ${businessName} (${website}). Use catalog prices; do not invent SKUs or discounts. For store visits, quote the WhatsApp number for the customer's city when known, otherwise the central line. Only state shipping, returns, exchange, or buyback as written in the indexed policies.`
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

router.post("/import-from-website", async (req, res) => {
  const { url, pageLimit = 60 } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: "url is required" });
  const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

  try {
    const pages = await crawlSite(normalizedUrl, Number(pageLimit) || 60);
    if (pages.length === 0) return res.status(422).json({ error: "Could not fetch any page content from that URL" });
      const signals = mergeSignals(pages);
    const heuristics = heuristicProfile(pages, signals, normalizedUrl);
    const combinedText = pagesForModel(pages);

    const row = await getProfile();
    row.website = normalizedUrl;

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

    const newlyPrefilled = [];
    for (const key of FIELDS) {
      if (key === "website") {
        row.website = normalizedUrl;
        newlyPrefilled.push("website");
        continue;
      }
      if (merged[key]) {
        row[key] = merged[key];
        newlyPrefilled.push(key);
      }
    }

    const prefilled = new Set([...JSON.parse(row.prefilledFields), ...newlyPrefilled]);
    row.prefilledFields = JSON.stringify([...prefilled]);
    await row.save();

    res.json({
      profile: serialize(row),
      pagesFetched: pages.length,
      usedLLM,
      pages: pages.map((p) => ({ url: p.url, title: p.title, score: p.score })),
    });
  } catch (err) {
    console.error("[businessProfile import] error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
