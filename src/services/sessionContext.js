import { detectCategoryIntent, isPriceAsk } from "./zitharaProd.js";
import { findStore } from "./storeDirectory.js";

const SHOW_MORE = /\b(show me )?(more|aur) (designs?|options?|pieces?|rings?|earrings?|necklaces?)|show more|any more|aur dikhao|more like this|similar\b/i;
const SCHEDULE_CALL = /\b(call me|schedule|book (a )?(call|appointment)|video call|callback|call back)\b/i;
const INTERESTED = /\b(interested|i (like|love|want) (this|it)|this one|book this|hold this)\b/i;

export function emptySession(channel = "web") {
  return {
    channel,
    phone: null,
    city: null,
    storeId: null,
    category: null,
    categorySource: null,
    budgetMin: null,
    budgetMax: null,
    interestedProducts: [],
    ad: null,
    lastShownProducts: [],
    catalogOffset: 0,
  };
}

export function readSession(convo) {
  try {
    const parsed = convo.sessionContext ? JSON.parse(convo.sessionContext) : null;
    return parsed && typeof parsed === "object" ? { ...emptySession(convo.channel), ...parsed } : emptySession(convo.channel);
  } catch {
    return emptySession(convo.channel);
  }
}

export function isShowMore(message) {
  return SHOW_MORE.test(String(message || ""));
}

export function wantsScheduleCall(message) {
  return SCHEDULE_CALL.test(String(message || ""));
}

function parseBudget(message) {
  const text = String(message || "").toLowerCase();
  const under = text.match(/(?:under|below|upto|up to|budget)\s*(?:of\s*)?(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(k|lakh|lac|l)?/i);
  const range = text.match(/(\d+(?:\.\d+)?)\s*(k|lakh|lac|l)?\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(k|lakh|lac|l)?/i);
  const toAmount = (n, unit) => {
    const value = Number(n);
    if (!value) return null;
    const u = String(unit || "").toLowerCase();
    if (u === "k") return value * 1000;
    if (u === "lakh" || u === "lac" || u === "l") return value * 100000;
    return value < 1000 ? value * 1000 : value;
  };
  if (range) {
    return { budgetMin: toAmount(range[1], range[2]), budgetMax: toAmount(range[3], range[4] || range[2]) };
  }
  if (under) {
    return { budgetMin: null, budgetMax: toAmount(under[1], under[2]) };
  }
  return { budgetMin: null, budgetMax: null };
}

function parsePhone(message) {
  const match = String(message || "").replace(/[^\d+]/g, " ").match(/(?:\+91)?[6-9]\d{9}/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "").slice(-10);
  return `+91 ${digits}`;
}

export function parseMessageSignals(message) {
  const text = String(message || "");
  const intent = detectCategoryIntent(text);
  const budget = parseBudget(text);
  const store = findStore(text);
  return {
    category: intent?.id || null,
    budgetMin: budget.budgetMin,
    budgetMax: budget.budgetMax,
    city: store?.city || null,
    storeId: store?.id || null,
    phone: parsePhone(text),
    showMore: isShowMore(text),
    scheduleCall: wantsScheduleCall(text),
    interested: INTERESTED.test(text),
  };
}

export function inferCategoryFromAd(ad) {
  if (!ad) return null;
  return detectCategoryIntent([ad.adName, ad.referralHeadline, ad.referralBody, ad.productName].filter(Boolean).join(" "))?.id || null;
}

export function phonePolicy(channel, session) {
  const ch = String(channel || session.channel || "web").toLowerCase();
  const hasPhone = Boolean(session.phone?.number);
  if (ch === "whatsapp") {
    return {
      channel: "whatsapp",
      hasPhone,
      number: session.phone?.number || null,
      instruction: hasPhone
        ? `WhatsApp: do not ask for a new number. When scheduling a call, ask them to confirm this WhatsApp number: ${session.phone.number}.`
        : "WhatsApp: do not ask them to type a phone number. When scheduling a call, ask them to confirm you may use this WhatsApp chat’s number.",
    };
  }
  if (ch === "instagram" || ch === "facebook") {
    return {
      channel: ch,
      hasPhone,
      number: session.phone?.number || null,
      instruction: hasPhone
        ? `Instagram/Facebook: a number is already on file (${session.phone.number}). Do not ask again. Confirm it only if they want a call.`
        : "Instagram/Facebook: no phone is on file. Ask for a WhatsApp number only if they want a call, appointment, or shipping update.",
    };
  }
  return {
    channel: ch,
    hasPhone,
    number: session.phone?.number || null,
    instruction: hasPhone
      ? `A number is on file (${session.phone.number}). Confirm it for a call instead of asking again.`
      : "Ask for a WhatsApp number only if they want a call or appointment.",
  };
}

export function updateSessionContext({ session, channel, signals, adContext, customerPhone, catalogProducts }) {
  const next = { ...session, channel: channel || session.channel };

  if (adContext?.adId) {
    next.ad = {
      adId: adContext.adId,
      adName: adContext.adName || null,
      productName: adContext.productName || null,
      headline: adContext.referralHeadline || null,
    };
    const cityFromAd = findStore([adContext.adName, adContext.referralBody, adContext.referralHeadline].filter(Boolean).join(" "));
    if (cityFromAd && !next.city) {
      next.city = cityFromAd.city;
      next.storeId = cityFromAd.id;
    }
    if (!next.category) {
      const fromAd = inferCategoryFromAd(adContext);
      if (fromAd) {
        next.category = fromAd;
        next.categorySource = "ad";
      }
    }
  }

  if (signals.category) {
    next.category = signals.category;
    next.categorySource = "message";
    next.catalogOffset = 0;
  }

  if (signals.budgetMin != null) next.budgetMin = signals.budgetMin;
  if (signals.budgetMax != null) next.budgetMax = signals.budgetMax;
  if (signals.city) {
    next.city = signals.city;
    next.storeId = signals.storeId;
  }

  const incomingPhone = customerPhone || signals.phone;
  if (incomingPhone) {
    next.phone = { number: incomingPhone, source: customerPhone ? channel : "user", confirmed: Boolean(customerPhone) };
  }

  if (signals.category) next.catalogOffset = 0;

  if (catalogProducts?.length) {
    next.lastShownProducts = catalogProducts.map((p) => ({ name: p.name, price: p.price, url: p.url, category: p.category }));
  }

  if (signals.interested) {
    const pick = next.lastShownProducts?.[0] || (adContext?.productName ? { name: adContext.productName } : null);
    if (pick?.name && !next.interestedProducts.some((p) => p.name === pick.name)) {
      next.interestedProducts = [...next.interestedProducts, pick].slice(-8);
    }
  }

  return next;
}

export { isPriceAsk };

export function catalogQueryForSession(message, session, signals, adContext) {
  if (signals.category && signals.category !== session.category) {
    return { query: message, categoryId: signals.category, offset: 0 };
  }
  if (isPriceAsk(message)) {
    if (session.lastShownProducts?.length) return { reuseLast: true, query: session.category || "pp" };
    if (adContext?.productName) return { query: adContext.productName, categoryId: null, offset: 0 };
    if (session.category) return { query: session.category, categoryId: session.category, offset: 0 };
    return { featured: true, query: "pp" };
  }
  if (signals.category) return { query: message, categoryId: signals.category, offset: 0 };
  if (signals.showMore && session.category) {
    return { query: session.category, categoryId: session.category, offset: session.catalogOffset || 0 };
  }
  if (!detectCategoryIntent(message) && session.category && /design|similar|like this|options|pieces/i.test(message || "")) {
    return { query: session.category, categoryId: session.category, offset: session.catalogOffset || 0 };
  }
  return { query: message, categoryId: detectCategoryIntent(message)?.id || null, offset: 0 };
}
