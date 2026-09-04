import { detectCategoryIntent, isPriceAsk } from "./zitharaProd.js";
import { findStore } from "./storeDirectory.js";

const SHOW_MORE = /\b(show me )?(more|aur) (designs?|options?|pieces?|rings?|earrings?|necklaces?)|show more|any more|aur dikhao|more like this|similar\b/i;
const SCHEDULE_CALL = /\b(call me|give me a call|can you call|please call|schedule|book (a )?(call|appointment)|video call|callback|call back|arrange a (call|visit)|want a call)\b/i;
const STORE_ASK = /\b(store|stores|shop|boutique|nearest|near me|visit|address|location|which city|what city|where are you|hours|timing|map|branch|branches)\b/i;
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

export function wantsStoreInfo(message) {
  return STORE_ASK.test(String(message || ""));
}

export function formatPhoneDisplay(number) {
  const digits = String(number || "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return number || "";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

const NUM = "(\\d+(?:[.,]\\d+)?)";
const UNIT = "(k|lakh|lac|l|thousand|hazar)?";

function toBudgetAmount(n, unit) {
  const value = Number(String(n || "").replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = String(unit || "").toLowerCase();
  if (u === "k" || u === "thousand" || u === "hazar") return value * 1000;
  if (u === "lakh" || u === "lac" || u === "l") return value * 100000;
  return value < 1000 ? value * 1000 : value;
}

export function parseBudget(message) {
  const text = String(message || "")
    .toLowerCase()
    .replace(/₹/g, " ")
    .replace(/\b(?:rs\.?|inr|rupees?)\b/g, " ");

  const between = text.match(new RegExp(`between\\s*${NUM}\\s*${UNIT}\\s*(?:and|to|–|-)\\s*${NUM}\\s*${UNIT}`));
  if (between) {
    return { budgetMin: toBudgetAmount(between[1], between[2]), budgetMax: toBudgetAmount(between[3], between[4] || between[2]) };
  }

  const range = text.match(new RegExp(`${NUM}\\s*${UNIT}\\s*(?:-|to|–|se)\\s*${NUM}\\s*${UNIT}`));
  if (range) {
    return { budgetMin: toBudgetAmount(range[1], range[2]), budgetMax: toBudgetAmount(range[3], range[4] || range[2]) };
  }

  const cap = text.match(new RegExp(
    `(?:under|below|upto|up\\s*to|within|around|about|till|until|max(?:imum)?|budget(?:\\s+is|\\s+of)?)\\s*${NUM}\\s*${UNIT}`
  ));
  if (cap) {
    return { budgetMin: null, budgetMax: toBudgetAmount(cap[1], cap[2]) };
  }

  return { budgetMin: null, budgetMax: null };
}

export function isBudgetMessage(message) {
  const budget = parseBudget(message);
  return budget.budgetMin != null || budget.budgetMax != null;
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

export function phonePolicy(channel, session, { wantsCall = false } = {}) {
  const ch = String(channel || session.channel || "web").toLowerCase();
  const hasPhone = Boolean(session.phone?.number);
  const pretty = formatPhoneDisplay(session.phone?.number);
  if (!wantsCall) {
    return {
      channel: ch,
      hasPhone,
      number: session.phone?.number || null,
      instruction: "CALL FLOW: they did not ask for a call. Do not mention a callback, stylist call, 'number on file', Instagram/WhatsApp number, or 'we can contact you'. Answer only what they asked.",
    };
  }

  const steps = `CALL FLOW (they asked to be called). One warm step at a time — no jargon:
1) Confirm: "Happy to arrange a call with our stylist."
2) If city is unknown, ask which city first.
3) Confirm the number. Never say "on file" or "Instagram number".
4) Ask morning / afternoon / evening, today or tomorrow.
5) Close: "Our team will call you then." Do not add the store address unless they also asked to visit.`;

  if (ch === "whatsapp") {
    return {
      channel: "whatsapp",
      hasPhone,
      number: session.phone?.number || null,
      instruction: `${steps}\nWhatsApp: do not ask them to type a new number. Ask: "We'll call you on this WhatsApp number — does that work?"${pretty ? ` Display as ${pretty} only if they ask to see it.` : ""}`,
    };
  }
  if (ch === "instagram" || ch === "facebook") {
    return {
      channel: ch,
      hasPhone,
      number: session.phone?.number || null,
      instruction: hasPhone
        ? `${steps}\nA WhatsApp number is available (${pretty}). Ask: "Shall we reach you on ${pretty}?" Do not call it an Instagram number.`
        : `${steps}\nNo WhatsApp number yet. Ask once: "Please share a WhatsApp number we can call."`,
    };
  }
  return {
    channel: ch,
    hasPhone,
    number: session.phone?.number || null,
    instruction: hasPhone
      ? `${steps}\nConfirm: "Shall we reach you on ${pretty}?"`
      : `${steps}\nAsk once for a WhatsApp number.`,
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
  if (signals.budgetMin != null || signals.budgetMax != null) next.catalogOffset = 0;
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
  const budgetJustSet = signals.budgetMin != null || signals.budgetMax != null;
  const categoryId = signals.category || session.category || detectCategoryIntent(message)?.id || null;

  if (signals.category && signals.category !== session.category) {
    return { query: budgetJustSet ? signals.category : message, categoryId: signals.category, offset: 0 };
  }
  if (budgetJustSet) {
    if (categoryId) {
      return { query: categoryId, categoryId, offset: 0, preferLastShown: true };
    }
    if (session.lastShownProducts?.length) {
      return { reuseLast: true, query: "pp", preferLastShown: true };
    }
    return { featured: true, query: "pp" };
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
