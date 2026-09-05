import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

let pool = null;

export function zitharaProdConfigured() {
  return Boolean(config.zitharaProdUrl);
}

export function getZitharaProdPool() {
  if (!config.zitharaProdUrl) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: config.zitharaProdUrl,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: config.zitharaProdSsl ? { rejectUnauthorized: false } : false,
    });
    pool.on("error", (err) => console.error("[zitharaProd] idle client error:", err.message));
  }
  return pool;
}

export async function pingZitharaProd() {
  const client = getZitharaProdPool();
  if (!client) return { configured: false, ok: false, productCount: 0 };
  try {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n
       FROM meta_catalog_products
       WHERE merchant_id = $1`,
      [config.tyaaniMerchantId]
    );
    return { configured: true, ok: true, productCount: rows[0]?.n || 0, merchantId: config.tyaaniMerchantId };
  } catch (err) {
    console.error("[zitharaProd] ping failed:", err.message);
    return { configured: true, ok: false, error: err.message, productCount: 0 };
  }
}

const CATALOG_SKIP = new Set([
  "pp", "this", "this one", "ok", "okay", "yes", "no", "hi", "hello", "hey",
  "thanks", "thank you", "hmm", "hm", "pls", "please",
]);

// Longer / more specific tokens first so "earrings" never falls into "rings".
const CATEGORY_INTENTS = [
  {
    id: "earrings",
    tokens: ["earrings", "earring", "jhumka", "jhumkas", "chandbali", "chandbalis", "hoops"],
    categories: ["Earrings", "Long Earrings", "Chandbalis", "Hoops", "Tops"],
    rejectName: /\b(ring|rings)\b/i,
  },
  {
    id: "rings",
    tokens: ["rings", "ring"],
    categories: ["Rings"],
    rejectName: /\b(earring|earrings|jhumka|chandbali|choker|necklace|bangle|bracelet)\b/i,
    rejectCategory: /earring|set|necklace|choker|bangle|bracelet|pendant|tops/i,
  },
  {
    id: "necklaces",
    tokens: ["necklaces", "necklace"],
    categories: ["Necklaces", "Long Necklaces"],
    rejectName: /\b(earring|ring|bangle)\b/i,
  },
  {
    id: "chokers",
    tokens: ["chokers", "choker"],
    categories: ["Chokers"],
  },
  {
    id: "bangles",
    tokens: ["bangles", "bangle"],
    categories: ["Bangles"],
  },
  {
    id: "bracelets",
    tokens: ["bracelets", "bracelet"],
    categories: ["Bracelets", "Loose Bracelets"],
  },
  {
    id: "pendants",
    tokens: ["pendants", "pendant"],
    categories: ["Pendants", "Charms & Pendants"],
  },
  {
    id: "sets",
    tokens: ["sets", "set"],
    categories: ["Jewelry Sets"],
  },
  {
    id: "tops",
    tokens: ["tops", "studs"],
    categories: ["Tops"],
  },
];

export function isPriceAsk(query) {
  const q = String(query || "").trim();
  if (!q) return false;
  if (/^(pp|price|prize|rate|cost|kitna|kya price|how much)\b/i.test(q)) return true;
  return /\b(pp|how much|what(?:'s| is) (the )?price|know the price|tell me the price|price of|cost of|kya (price|rate)|kitna|kitne ka|pricing)\b/i.test(q)
    || /\b(price|prize|rate)\b/i.test(q);
}

export function shouldSearchCatalog(query, session = null) {
  const q = String(query || "").trim().toLowerCase();
  if (isPriceAsk(q)) return true;
  if (session?.category && /\b(more|designs?|similar|options?|pieces?)\b/i.test(q)) return true;
  if (/\b(budget|under|below|upto|up to|within|between|lakh|lac|\dk)\b/i.test(q)) return true;
  if (q.length < 3 || CATALOG_SKIP.has(q)) return false;
  return true;
}

function normalizeCategoryQuery(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/ear[\s._-]*rings?/g, "earring")
    .replace(/\bearings?\b/g, "earring");
}

function queryTokens(query) {
  return normalizeCategoryQuery(query).split(/[^a-z0-9]+/).filter(Boolean);
}

export function detectCategoryIntent(query) {
  const normalized = normalizeCategoryQuery(query);
  const tokens = queryTokens(normalized);
  if (/\bearrings?\b/.test(normalized) || (tokens.includes("ear") && tokens.some((t) => t === "ring" || t === "rings"))) {
    return CATEGORY_INTENTS.find((intent) => intent.id === "earrings") || null;
  }
  return CATEGORY_INTENTS.find((intent) => intent.tokens.some((token) => tokens.includes(token))) || null;
}

const BUDGET_STOP = new Set([
  "the", "and", "for", "with", "from", "under", "below", "upto", "budget",
  "lakh", "lac", "more", "show", "designs", "design", "options", "pieces",
  "within", "around", "about", "between", "till", "until", "max", "maximum",
  "inr", "rupee", "rupees", "thousand", "hazar", "want", "like", "please",
  "mera", "meri", "mere", "hai", "hain",
]);

function isBudgetToken(token) {
  return /^(?:\d+(?:\.\d+)?)(k|lakh|lac|l|thousand|hazar)?$/.test(token)
    || BUDGET_STOP.has(token);
}

function extraNameFilters(query, intent) {
  const reserved = new Set(intent?.tokens || []);
  return queryTokens(query).filter((token) => token.length > 2 && !reserved.has(token) && !isBudgetToken(token));
}

export function productInBudget(product, budgetMin, budgetMax) {
  const price = Number(product?.price);
  if (!Number.isFinite(price)) return false;
  if (budgetMin != null && Number(budgetMin) > 0 && price < Number(budgetMin)) return false;
  if (budgetMax != null && Number(budgetMax) > 0 && price > Number(budgetMax)) return false;
  return true;
}

export function filterByBudget(products, budgetMin, budgetMax) {
  const list = Array.isArray(products) ? products : [];
  if (!Number(budgetMin) && !Number(budgetMax)) return list;
  return list.filter((p) => productInBudget(p, budgetMin, budgetMax));
}

function keepRow(row, intent) {
  const name = String(row.name || "");
  const category = String(row.category || "");
  if (intent?.rejectName?.test(name)) return false;
  if (intent?.rejectCategory?.test(category)) return false;
  if (intent?.id === "rings" && /earring/i.test(name)) return false;
  if (intent?.categories?.length && category && !intent.categories.includes(category)) return false;
  return true;
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function looksDeadUrl(value) {
  return /\/cdn\/shop\/files\/sample|facebook\.com\/ads\/image\/\?d=sample/i.test(String(value || ""));
}

export function normalizeCatalogProduct(row, website = "") {
  if (!row) return row;
  const image = isHttpUrl(row.image_url) && !looksDeadUrl(row.image_url) ? row.image_url : "";
  let url = isHttpUrl(row.url) && !looksDeadUrl(row.url) ? row.url : "";
  if (!url) {
    try {
      const origin = website ? new URL(/^https?:/i.test(website) ? website : `https://${website}`).origin : "";
      const handle = String(row.retailer_id || "").split("/").pop();
      if (origin && handle && /^[a-z0-9][a-z0-9-]*$/i.test(handle)) url = `${origin}/products/${handle}`;
      else if (origin && String(row.url || "").startsWith("/")) url = `${origin}${row.url}`;
    } catch {
      // keep empty
    }
  }
  return { ...row, image_url: image, url };
}

function dedupeCatalog(rows, limit, intent) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!keepRow(row, intent)) continue;
    const key = String(row.name || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export async function searchCatalogProducts(query, limit = 8, options = {}) {
  const client = getZitharaProdPool();
  if (!client) return [];
  const q = String(query || "").trim().slice(0, 200);
  if (!q && !options.categoryId) return [];
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const intent = (options.categoryId && CATEGORY_INTENTS.find((item) => item.id === options.categoryId))
    || detectCategoryIntent(q);
  const extras = extraNameFilters(q, intent);
  const budgetMin = Number(options.budgetMin) || null;
  const budgetMax = Number(options.budgetMax) || null;
  const cap = Math.min(Math.max(Number(limit) || 8, 1) * 8, 64);
  const take = Math.min(Number(limit) || 8, 12);

  const select = `SELECT
       meta_product_id,
       retailer_id,
       name,
       LEFT(description, 400) AS description,
       price,
       sale_price,
       currency,
       category,
       COALESCE(NULLIF(image_url, ''), NULLIF(image_s3_url, '')) AS image_url,
       url,
       availability,
       inventory
     FROM meta_catalog_products`;

  const priceOk = `price IS NOT NULL AND price > 500`;
  const extraClause = extras.map((_, i) => `name ILIKE $${i + 4} ESCAPE '\\'`).join(" AND ");
  const extraParams = extras.map((token) => `%${token.replace(/[%_]/g, "\\$&")}%`);
  const budgetClause = [
    budgetMin ? `price >= ${Number(budgetMin)}` : "",
    budgetMax ? `price <= ${Number(budgetMax)}` : "",
  ].filter(Boolean).join(" AND ");
  const leftoverTokens = queryTokens(q).filter((t) => t.length > 2 && !isBudgetToken(t) && !(intent?.tokens || []).includes(t));
  const skipNameMatch = leftoverTokens.length === 0 && (budgetMin || budgetMax);

  let rows;
  if (intent) {
    const result = await client.query(
      `${select}
       WHERE merchant_id = $1
         AND ${priceOk}
         AND category = ANY($2::text[])
         AND name !~* $3
         ${extraClause ? `AND ${extraClause}` : ""}
         ${budgetClause ? `AND ${budgetClause}` : ""}
       ORDER BY
         CASE WHEN availability ILIKE '%in stock%' THEN 0 ELSE 1 END,
         price ASC NULLS LAST
       LIMIT $${4 + extras.length}
       OFFSET ${Math.max(Number(options.offset) || 0, 0)}`,
      [
        config.tyaaniMerchantId,
        intent.categories,
        intent.id === "rings" ? "earring|jhumka|chandbali" : "^$",
        ...extraParams,
        cap,
      ]
    );
    rows = result.rows;
    if (!rows.length && extras.length) {
      const fallback = await client.query(
        `${select}
         WHERE merchant_id = $1
           AND ${priceOk}
           AND category = ANY($2::text[])
           AND name !~* $3
           ${budgetClause ? `AND ${budgetClause}` : ""}
         ORDER BY
           CASE WHEN availability ILIKE '%in stock%' THEN 0 ELSE 1 END,
           price ASC NULLS LAST
         LIMIT $4`,
        [config.tyaaniMerchantId, intent.categories, intent.id === "rings" ? "earring|jhumka|chandbali" : "^$", cap]
      );
      rows = fallback.rows;
    }
  } else if (skipNameMatch) {
    const result = await client.query(
      `${select}
       WHERE merchant_id = $1
         AND ${priceOk}
         ${budgetClause ? `AND ${budgetClause}` : ""}
       ORDER BY
         CASE WHEN availability ILIKE '%in stock%' THEN 0 ELSE 1 END,
         price ASC NULLS LAST
       LIMIT $2`,
      [config.tyaaniMerchantId, cap]
    );
    rows = result.rows;
  } else {
    const result = await client.query(
      `${select}
       WHERE merchant_id = $1
         AND ${priceOk}
         AND (
           name ILIKE $2 ESCAPE '\\'
           OR retailer_id ILIKE $2 ESCAPE '\\'
         )
         ${budgetClause ? `AND ${budgetClause}` : ""}
       ORDER BY
         CASE WHEN name ILIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END,
         CASE WHEN availability ILIKE '%in stock%' THEN 0 ELSE 1 END,
         price ASC NULLS LAST
       LIMIT $3`,
      [config.tyaaniMerchantId, like, cap]
    );
    rows = result.rows;
  }
  return dedupeCatalog(rows, take, intent);
}

const FEATURED_SELECT = `SELECT
       meta_product_id,
       retailer_id,
       name,
       LEFT(description, 400) AS description,
       price,
       sale_price,
       currency,
       category,
       COALESCE(NULLIF(image_url, ''), NULLIF(image_s3_url, '')) AS image_url,
       url,
       availability,
       inventory
     FROM meta_catalog_products`;

export async function getProductsByNames(names, limit = 8) {
  const client = getZitharaProdPool();
  const list = (names || []).map((n) => String(n || "").trim()).filter(Boolean).slice(0, 12);
  if (!client || !list.length) return [];
  const { rows } = await client.query(
    `${FEATURED_SELECT}
     WHERE merchant_id = $1
       AND name = ANY($2::text[])
       AND price IS NOT NULL AND price > 500
     ORDER BY price ASC
     LIMIT $3`,
    [config.tyaaniMerchantId, list, limit]
  );
  return dedupeCatalog(rows, limit, null);
}

function formatInr(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return "price on request";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatCatalogPriceReply(products, { hasAd = false, hasAdProduct = false, offer = "", budgetMin = null, budgetMax = null, nearbyBudget = false } = {}) {
  const lines = (products || []).slice(0, 6).map((p) => {
    const cat = p.category ? ` (${p.category})` : "";
    return `• ${p.name}${cat} — ${formatInr(p.price)}`;
  });
  const offerText = String(offer || "").replace(/\.$/, "").trim();
  const lead = offerText
    ? `You opened from our ${offerText} offer. `
    : hasAd
    ? "You opened from the Tyaani ad. "
    : "";
  const range = [budgetMin, budgetMax].filter((n) => Number(n) > 0).map((n) => formatInr(n)).join("–");
  const intro = nearbyBudget && range
    ? `${lead}Nothing sat exactly in ${range}, so here are the closest pieces:`
    : range
    ? `${lead}Here are pieces in your ${range} range:`
    : hasAdProduct
    ? `${lead}Here are reference prices for this design and a few similar pieces:`
    : `${lead}Here are a few pieces with reference prices:`;
  return `${intro}\n\n${lines.join("\n")}\n\nPrices can move with the gold rate and any custom work. Tell me rings, earrings, a necklace, or a budget and I’ll narrow it.`;
}

export function catalogReplyMissesProducts(reply, products) {
  const text = String(reply || "");
  if (/sorry, something went wrong|let me connect you with our team|don'?t have|do not have|no (specific |catalog )?match|nothing in (this |your )?budget|no \w+ (in|within) (the |your )?budget|not available in (the )?catalog|not (currently )?in context|specify the (design|category)|which (design|category)|what (design|category)|does not map to one sku|shopify (catalog|reference)|featured tyaani/i.test(text)) {
    return true;
  }
  return !(products || []).some((p) => {
    const name = String(p.name || "").trim();
    return name.length >= 4 && text.toLowerCase().includes(name.toLowerCase());
  });
}

export async function listFeaturedCatalogProducts(limit = 8, options = {}) {
  const client = getZitharaProdPool();
  if (!client) return [];
  const take = Math.min(Number(limit) || 8, 12);
  const budgetMin = Number(options.budgetMin) || null;
  const budgetMax = Number(options.budgetMax) || null;
  const budgetClause = [
    budgetMin ? `AND price >= ${Number(budgetMin)}` : "",
    budgetMax ? `AND price <= ${Number(budgetMax)}` : "",
  ].join(" ");
  const { rows } = await client.query(
    `${FEATURED_SELECT}
     WHERE merchant_id = $1
       AND price IS NOT NULL AND price > 500
       AND availability ILIKE '%in stock%'
       AND category = ANY($2::text[])
       ${budgetClause}
     ORDER BY price ASC
     LIMIT $3`,
    [config.tyaaniMerchantId, ["Rings", "Earrings", "Necklaces", "Tops", "Bangles"], take * 10]
  );
  const unique = dedupeCatalog(rows, rows.length, null);
  const buckets = new Map();
  for (const row of unique) {
    const list = buckets.get(row.category) || [];
    if (list.length < 2) {
      list.push(row);
      buckets.set(row.category, list);
    }
  }
  const mixed = [];
  let added = true;
  while (mixed.length < take && added) {
    added = false;
    for (const list of buckets.values()) {
      if (!list.length) continue;
      mixed.push(list.shift());
      added = true;
      if (mixed.length >= take) break;
    }
  }
  return mixed.length ? mixed : unique.slice(0, take);
}

export async function listAdSets(query = "") {
  const client = getZitharaProdPool();
  if (!client) return [];
  const q = String(query || "").trim().slice(0, 120);
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const { rows } = await client.query(
    `SELECT
       ad_set_id AS "adSetId",
       COALESCE(NULLIF(adset_name, ''), name) AS name,
       status,
       effective_status AS "effectiveStatus"
     FROM meta_ad_sets
     WHERE merchant_id = $1
       AND ($2 = '' OR COALESCE(adset_name, name) ILIKE $3 ESCAPE '\\')
     ORDER BY name NULLS LAST
     LIMIT 250`,
    [config.tyaaniMerchantId, q, like]
  );
  return rows;
}

export async function listLiveAdsForImport({ query = "", adSetIds = [], limit = 250 } = {}) {
  return searchLiveAds({ query, adSetIds, limit: Math.min(Number(limit) || 250, 400) });
}

export async function searchLiveAds({ query = "", adSetIds = [], limit = 25 } = {}) {
  const client = getZitharaProdPool();
  if (!client) return [];
  const q = String(query || "").trim().slice(0, 120);
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const ids = Array.isArray(adSetIds) ? adSetIds.map(String).filter(Boolean).slice(0, 80) : [];
  const { rows } = await client.query(
    `SELECT
       a.ad_id AS "adId",
       a.name,
       a.adset_name AS "adsetName",
       a.ad_set_id AS "adSetId",
       a.status,
       a.ad_creative_id AS "creativeId"
     FROM meta_ads a
     WHERE a.merchant_id = $1
       AND (cardinality($2::text[]) = 0 OR a.ad_set_id = ANY($2))
       AND (
         $3 = ''
         OR a.name ILIKE $4 ESCAPE '\\'
         OR a.ad_id ILIKE $4 ESCAPE '\\'
         OR COALESCE(a.adset_name, '') ILIKE $4 ESCAPE '\\'
       )
     ORDER BY a.updated_at DESC NULLS LAST
     LIMIT $5`,
    [config.tyaaniMerchantId, ids, q, like, Math.min(Number(limit) || 25, 400)]
  );
  return rows;
}

export async function getAdReferralContext(adId) {
  const client = getZitharaProdPool();
  if (!client || !adId) return null;
  const { rows } = await client.query(
    `SELECT
       a.ad_id,
       a.name AS ad_name,
       a.adset_name,
       c.body AS creative_body,
       c.title AS creative_title,
       c.call_to_action_type,
       COALESCE(c.thumbnail_s3_url, c.thumbnail_url) AS thumbnail_url
     FROM meta_ads a
     LEFT JOIN meta_ad_creatives c ON c.ad_creative_id = a.ad_creative_id
     WHERE a.merchant_id = $1 AND a.ad_id = $2
     LIMIT 1`,
    [config.tyaaniMerchantId, String(adId)]
  );
  return rows[0] || null;
}
