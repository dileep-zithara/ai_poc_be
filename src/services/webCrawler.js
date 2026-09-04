import * as cheerio from "cheerio";

const MAX_CHARS_PER_PAGE = 50_000;
const FETCH_TIMEOUT_MS = 12_000;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const SKIP_RE =
  /\/(cart|checkouts?|account|cdn\/|search|tools\/|apps\/)|swym|wishlist|look-?book|franchise-deck|customer-data|customer-feedback|walkin-form|google-reviews|reviews-and-feedback/i;
const CELEBRITY_PAGE_RE = /\/pages\/[a-z0-9-]+-(jewellery|jewelry)$/i;

export function sameSite(url, baseUrl) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./, "");
    return host === baseHost;
  } catch {
    return false;
  }
}

export function normalizePageUrl(href, baseUrl) {
  try {
    const abs = new URL(href, baseUrl);
    if (!abs.protocol.startsWith("http")) return null;
    if (!sameSite(abs, baseUrl)) return null;
    abs.hash = "";
    abs.search = "";
    abs.hostname = new URL(baseUrl).hostname;
    if (abs.pathname.startsWith("/en-us")) {
      abs.pathname = abs.pathname.replace(/^\/en-us/, "") || "/";
    }
    const cleaned = abs.toString().replace(/\/$/, "");
    return cleaned || abs.origin;
  } catch {
    return null;
  }
}

export function shouldSkipUrl(url) {
  const path = new URL(url).pathname;
  return SKIP_RE.test(url) || CELEBRITY_PAGE_RE.test(path);
}

export function scoreUrl(url) {
  const path = new URL(url).pathname.toLowerCase();
  if (path === "/" || path === "") return 100;
  if (/\/pages\/(about-us|stores|contact-us|faqs|shipping-policy|terms-and-conditions|privacy-policy)$/.test(path)) return 95;
  if (/\/policies\//.test(path)) return 94;
  if (/\/pages\/(certification|know-your-polki|polki-jewellery-stores|team-tyaani)$/.test(path)) return 88;
  if (/\/pages\/.*store/.test(path) || /\/pages\/(bandra|delhi|bangalore|hyderabad|pune|lucknow|ahmedabad|jalandhar|chandigarh|kolkata|surat|jammu)-/.test(path)) return 86;
  if (/\/collections\/.*store/.test(path) || /\/collections\/(jewellery-store|tyaani-)/.test(path)) return 72;
  if (/\/collections\/(all-polki|bridal|diamond|gold|gifting|engagement|bestsellers|ready-to-ship)/.test(path)) return 48;
  if (/\/pages\//.test(path)) return 56;
  if (/\/blogs\//.test(path)) return 28;
  if (/\/collections\//.test(path)) return 16;
  if (/\/products\//.test(path)) return 4;
  return 12;
}

function cleanText(value) {
  return String(value || "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

function extractText(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  const title = $("title").first().text().trim();
  const main = $("main, #MainContent, .shopify-policy__container, [role='main']").first();
  const root = main.length ? main.clone() : $("body").clone();
  root.find("nav, header, .header, .announcement-bar").remove();
  const text = cleanText(root.text());
  return { title, text };
}

export function extractPageSignals(html, pageUrl) {
  const $ = cheerio.load(html);
  const social = new Set();
  const emails = new Set();
  const whatsapp = [];
  const seenPhones = new Set();

  $("a[href]").each((_, el) => {
    const href = String($(el).attr("href") || "");
    const label = $(el).text().replace(/\s+/g, " ").trim();
    if (/instagram\.com|facebook\.com|youtube\.com|linkedin\.com|x\.com|twitter\.com/i.test(href)) {
      const clean = href.startsWith("http") ? href.split("?")[0] : href;
      if (!/instagram\.com\/(reel|p|tv|stories)\//i.test(clean) && !/instagram\.com\/?$/i.test(clean)) {
        social.add(clean);
      }
    }
    const mail = href.match(/^mailto:([^?]+)/i);
    if (mail) emails.add(mail[1]);
    const wa = href.match(/wa(?:me|\.me)\/(\d+)/i) || href.match(/[?&]phone=(\d{10,15})/i);
    if (wa) {
      const phone = wa[1].replace(/^91/, "+91 ");
      if (!seenPhones.has(phone)) {
        seenPhones.add(phone);
        const city = (href.match(/Tyaani%20([^%]+)%20store/i) || href.match(/Tyaani\s+([^&]+)\s+store/i) || [])[1];
        whatsapp.push({ phone, city: city ? decodeURIComponent(city.replace(/\+/g, " ")) : label || null, href });
      }
    }
  });

  const ogSite = $('meta[property="og:site_name"]').attr("content") || "";
  return { social: [...social], emails: [...emails], whatsapp, ogSite, pageUrl };
}

function extractSameDomainLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();
  $("a[href]").each((_, el) => {
    const abs = normalizePageUrl($(el).attr("href"), baseUrl);
    if (abs && !shouldSkipUrl(abs)) links.add(abs);
  });
  return [...links];
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverSitemapPages(startUrl) {
  const origin = new URL(startUrl).origin;
  const found = new Set();
  try {
    const indexRes = await fetchWithTimeout(`${origin}/sitemap.xml`);
    if (!indexRes.ok) return [];
    const indexXml = await indexRes.text();
    const sitemaps = [...indexXml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)].map((m) => m[1]);
    const pageMaps = sitemaps.filter((u) => /sitemap_pages|sitemap_collections/i.test(u) && !/\/en-us\//i.test(u));
    for (const mapUrl of pageMaps.slice(0, 4)) {
      const res = await fetchWithTimeout(mapUrl);
      if (!res.ok) continue;
      const xml = await res.text();
      const fromCollections = /sitemap_collections/i.test(mapUrl);
      for (const match of xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)) {
        const abs = normalizePageUrl(match[1], origin);
        if (!abs || shouldSkipUrl(abs)) continue;
        if (fromCollections && scoreUrl(abs) < 40) continue;
        found.add(abs);
      }
    }
  } catch {
    // sitemap is optional
  }
  return [...found];
}

function policySeeds(startUrl) {
  const origin = new URL(startUrl).origin;
  return [
    "/policies/shipping-policy",
    "/policies/refund-policy",
    "/policies/privacy-policy",
    "/policies/terms-of-service",
    "/pages/shipping-policy",
    "/pages/faqs",
    "/pages/stores",
    "/pages/about-us",
    "/pages/contact-us",
    "/pages/terms-and-conditions",
    "/pages/privacy-policy",
    "/pages/certification",
    "/pages/know-your-polki",
  ].map((path) => normalizePageUrl(origin + path, startUrl)).filter(Boolean);
}

async function fetchPage(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { links: [] };
    const type = res.headers.get("content-type") || "";
    if (type && !/html|xml|text\//i.test(type)) return { links: [] };
    const html = await res.text();
    const { title, text } = extractText(html);
    const signals = extractPageSignals(html, url);
    const page = text.length > 40
      ? { url, title, text: text.slice(0, MAX_CHARS_PER_PAGE), signals, score: scoreUrl(url) }
      : null;
    return { page, links: extractSameDomainLinks(html, url) };
  } catch {
    return { links: [] };
  }
}

/**
 * Crawls same-domain pages starting at `startUrl`, preferring brand / policy /
 * store pages over product listings. Returns [{ url, title, text, signals }].
 */
export async function crawlSite(startUrl, pageLimit = 2, onProgress) {
  const limit = Math.min(Math.max(Number(pageLimit) || 2, 1), 80);
  const start = normalizePageUrl(startUrl, startUrl) || startUrl;
  const queue = new Set([start]);
  const visited = new Set();
  const pages = [];
  const concurrency = 8;

  for (const seeded of await discoverSitemapPages(start)) queue.add(seeded);
  for (const seeded of policySeeds(start)) queue.add(seeded);

  const ordered = () => [...queue].filter((u) => !visited.has(u)).sort((a, b) => scoreUrl(b) - scoreUrl(a));

  while (pages.length < limit) {
    const batch = ordered().slice(0, Math.min(concurrency, limit - pages.length));
    if (!batch.length) break;
    for (const url of batch) visited.add(url);
    const results = await Promise.all(batch.map((url) => fetchPage(url)));
    for (const result of results) {
      if (result.page) pages.push(result.page);
      for (const link of result.links || []) {
        if (!visited.has(link)) queue.add(link);
      }
    }
    if (onProgress) await onProgress({ pagesFetched: pages.length });
  }

  return pages.sort((a, b) => (b.score || 0) - (a.score || 0));
}

export function mergeSignals(pages) {
  const social = new Set();
  const emails = new Set();
  const whatsapp = [];
  const seen = new Set();
  let ogSite = "";
  for (const page of pages) {
    const s = page.signals || {};
    if (s.ogSite) ogSite = s.ogSite;
    for (const link of s.social || []) social.add(link);
    for (const email of s.emails || []) emails.add(email);
    for (const row of s.whatsapp || []) {
      const key = `${row.phone}|${row.city || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      whatsapp.push(row);
    }
  }
  return { social: [...social], emails: [...emails], whatsapp, ogSite };
}
