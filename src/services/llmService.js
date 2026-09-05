import { displayWhatsApp } from "../config.js";
import { matchOfficialAnswer, tyaaniFactsBlock, TYAANI_CONTACTS } from "../data/tyaaniFacts.js";
import { callLLM } from "./llm/index.js";
import { formatCatalogPriceReply } from "./zitharaProd.js";

const SYSTEM_PROMPT = `You are the sales assistant for Tyaani Jewellery, a Karan Johar brand
(tyaani.com) — on website chat, WhatsApp, Instagram, and Facebook.

Tone: warm, clear, professional Tyaani stylist. Short messages. No slang, no
over-promising. Reply in the customer's language and script (Hindi, Hinglish,
Telugu, Kannada, Tamil, French, English, or any other they used).

GROUNDING
- TYAANI OFFICIAL FACTS and STORE CONTEXT are the only source for policies,
  brand story, shipping, returns, buyback, care, contacts, and store addresses.
- PRODUCT CATALOG MATCHES are the only source for product names, INR prices,
  availability, and links. Never invent a price, stock, delivery date, discount,
  certification, or store hours.
- If a fact is not in OFFICIAL FACTS, catalog, or STORE CONTEXT, say you will
  confirm with the team and give WhatsApp ${TYAANI_CONTACTS.whatsapp} or
  ${TYAANI_CONTACTS.email}. Do not guess.

JOURNEY
- Hi / hello: greet once (use first name if known), then ask how you can help
  — designs, prices, a store visit, or an order question.
- Product / price / "pp": quote catalog rows by name and INR. Stay in the
  category they named (rings vs earrings). Filter by budget when set.
- Store / visit: ask city if unknown, then quote that store only.
- Policy: quote OFFICIAL FACTS in plain language. Returns are not for change
  of mind. Damaged or wrong item: exchange within one week.
- Photo / screenshot: if the image is attached, look at it. Describe the
  jewellery (type, metal, stones, style) in one line. Quote matching catalog
  rows if present. If you cannot identify a SKU, say so and ask category +
  budget. Offer WhatsApp ${TYAANI_CONTACTS.whatsapp} for a stylist confirm.
- Audio / video: if the file is attached, listen or watch it. Answer that
  question. If you cannot hear or see it, ask them to type it.
- Correction ("that's wrong"): believe the official facts, correct yourself,
  do not argue.
- Outside the knowledge: do not invent. Offer WhatsApp ${TYAANI_CONTACTS.whatsapp}
  or email ${TYAANI_CONTACTS.email}. Hand off only if they ask for a person,
  an invoice lock, a damage claim, or a custom bridal brief that needs a store.

CALLS
- Do not offer a callback on a browse or price message.
- If they ask to be called, follow CALL FLOW. Central line:
  ${TYAANI_CONTACTS.whatsapp}. Returns line: ${TYAANI_CONTACTS.returns}.

Never invent stock, delivery dates, discounts, or store addresses.`;

function voiceBlock(settings) {
  const name = String(settings?.agentName || "Tyaani").trim() || "Tyaani";
  const gender = String(settings?.agentGender || "female").toLowerCase();
  const forms = gender === "male"
    ? "Use masculine first-person grammar in that language (verb endings, adjectives, participles)."
    : gender === "neutral"
    ? "Avoid gendered self-reference. Prefer phrasing that does not mark the speaker as male or female."
    : "Use feminine first-person grammar in that language (verb endings, adjectives, participles).";
  return `AGENT VOICE: Your name is ${name}. Gender for speech: ${gender}. ${forms}
Reply in the customer's language and script — Hindi, Telugu, Kannada, Tamil, Malayalam, Marathi, Gujarati, Bengali, French, English, or any other they used. Do not switch them to English or Hindi unless they wrote that.
If they ask your name, say ${name}. Do not sign every message with the name.`;
}

const RESPOND_TOOL = {
  name: "respond_to_customer",
  description: "Send the final response to the customer, with a handoff decision.",
  input_schema: {
    type: "object",
    properties: {
      reply: { type: "string", description: "The message to send to the customer." },
      handoff_needed: { type: "boolean", description: "True if this should be handed to a human agent." },
      handoff_reason: { type: "string", description: "Why handoff is needed, empty string if not needed." },
      resolved_product: {
        type: "string",
        description: "If the customer referred to a product by shorthand (e.g. 'this one', 'pp'), name the product you resolved it to. Empty string if not applicable.",
      },
    },
    required: ["reply", "handoff_needed", "handoff_reason", "resolved_product"],
  },
};

function sessionBlock(session, phone) {
  if (!session) return "SESSION CONTEXT: empty";
  const interested = (session.interestedProducts || []).map((p) => p.name).join(", ") || "none yet";
  return `SESSION CONTEXT (keep this updated in your reply):
Channel: ${session.channel || "web"}
Customer name: ${session.customerName || "not set"}
Customer first name: ${session.firstName || "not set"}
City / store: ${session.city || "not set"}
Category in play: ${session.category || "not set"} (source: ${session.categorySource || "none"})
Budget: ${session.budgetMin != null ? `INR ${Number(session.budgetMin).toLocaleString("en-IN")}` : "—"} to ${session.budgetMax != null ? `INR ${Number(session.budgetMax).toLocaleString("en-IN")}` : "—"}
Interested products: ${interested}
Ad in this session: ${session.ad?.adName || session.ad?.adId || "none"}
${phone?.instruction || ""}`;
}

function catalogBlock(catalogProducts, catalogPrimary) {
  if (!catalogProducts.length) return "PRODUCT CATALOG MATCHES: none for this message. Do not invent SKUs.";
  const rows = catalogProducts.map((p, i) => {
    const price = p.price != null ? `${p.currency || "INR"} ${Number(p.price).toLocaleString("en-IN")}` : "n/a";
    return `[P${i + 1}] ${p.name}
Price: ${price}${p.sale_price != null ? ` (sale ${p.sale_price})` : ""}
Availability: ${p.availability || "unknown"}
Category: ${p.category || "n/a"}
URL: ${p.url || "n/a — do not invent a shop link"}
Image: ${p.image_url || "n/a"}`;
  }).join("\n\n");
  const rank = catalogPrimary
    ? "These catalog rows OVERRIDE any product mention in the KB."
    : "";
  return `PRODUCT CATALOG MATCHES (live database — primary product source):\n${rank}\n${rows}`;
}

export async function generateResponse(userMessage, kbChunks, activeContext, history = [], catalogProducts = [], extras = {}) {
  const kbContext = kbChunks
    .map((c, i) => {
      const label = c.type === "qa" ? `Q: ${c.question}\nA: ${c.content}` : c.content;
      return `[${i + 1}] (${c.section})\n${label}`;
    })
    .join("\n\n");

  const activeContextBlock = activeContext
    ? `CURRENTLY ACTIVE AD / PRODUCT CONTEXT (short replies like "pp" / "this one" refer here unless they named a new category):
Ad ID: ${activeContext.adId || "unknown"}
Ad name: ${activeContext.adName || "unknown"}
Product: ${activeContext.productName || "unknown"}
Price: ${activeContext.productPrice || "not set"}
Referral headline: ${activeContext.referralHeadline || "none"}
Referral / creative copy: ${activeContext.referralBody || "none"}`
    : "CURRENTLY ACTIVE AD / PRODUCT CONTEXT: none.";

  const messages = [
    ...history,
    {
      role: "user",
      content: `${sessionBlock(extras.session, extras.phone)}

${activeContextBlock}

${catalogBlock(catalogProducts, extras.catalogPrimary)}

${tyaaniFactsBlock()}

KB CONTEXT (supporting snippets — OFFICIAL FACTS win if they disagree):
${kbContext || "(no extra KB snippets)"}

${extras.storeText || "STORE CONTEXT: none yet."}

${extras.greetNow && extras.session?.firstName
    ? `INSTRUCTION: Open with "Hi ${extras.session.firstName}," then answer. Do not invent another name.`
    : extras.greetNow
    ? "INSTRUCTION: Open with a short warm greeting, then answer. No name is known — do not invent one."
    : ""}
${catalogProducts.length
    ? extras.nearbyBudget
      ? "INSTRUCTION: No exact hit in their budget. Quote these closest PRODUCT CATALOG MATCHES by name and INR. Say they are the nearest pieces, not that the catalog is empty."
      : "INSTRUCTION: Quote PRODUCT CATALOG MATCHES by name and INR in the same breath. If a URL is present, you may mention it; if it is n/a, do not invent a link. Forbidden: asking for a design/category first, mentioning SKU/Shopify/mapping, or saying there is no product / nothing in this budget."
    : extras.session?.budgetMin != null || extras.session?.budgetMax != null
    ? "INSTRUCTION: Catalog search for this budget returned no rows. Say so in one line, then ask if they want a nearby price band or another category. Do not invent products."
    : extras.hasImage
    ? `INSTRUCTION: A photo is attached. Look at it. Name the jewellery type you see. Quote PRODUCT CATALOG MATCHES if they fit. Do not invent a SKU. Do not say sorry.`
    : extras.hasAudio || extras.hasVideo
    ? `INSTRUCTION: ${extras.hasAudio ? "Audio" : "Video"} is attached. Use it if the model can. Answer the spoken/shown question. If you cannot, ask them to type it.`
    : extras.wantsCorrection
    ? "INSTRUCTION: They said a previous answer was wrong. Correct from TYAANI OFFICIAL FACTS and catalog only. Apologize once. Do not invent a new fact."
    : ""}

CUSTOMER MESSAGE:
${userMessage}`,
    },
  ];

  try {
    const systemPrompt = `${voiceBlock(extras.settings)}\n\n${SYSTEM_PROMPT}`;
    return await callLLM({ systemPrompt, tool: RESPOND_TOOL, messages, media: extras.media || null });
  } catch (err) {
    console.error("[llmService] provider error:", err);
    return fallbackCustomerReply(userMessage, catalogProducts, extras);
  }
}

export function isBrokenReply(reply) {
  return /sorry, something went wrong|let me connect you with our team|i('m| am) sorry,? i (can'?t|cannot) (see|view|identify|process|help)/i.test(String(reply || ""));
}

export function fallbackCustomerReply(userMessage, catalogProducts = [], extras = {}) {
  const wa = extras.centralWhatsApp || TYAANI_CONTACTS.whatsapp || displayWhatsApp();
  const official = matchOfficialAnswer(userMessage);
  if (official) {
    return { reply: official, handoff_needed: false, handoff_reason: "", resolved_product: "" };
  }
  if (catalogProducts.length) {
    return {
      reply: formatCatalogPriceReply(catalogProducts, {
        hasAd: Boolean(extras.session?.ad?.adId || extras.hasAd),
        hasAdProduct: Boolean(extras.session?.ad?.productName),
        offer: extras.session?.ad?.headline || "",
        budgetMin: extras.session?.budgetMin,
        budgetMax: extras.session?.budgetMax,
        nearbyBudget: extras.nearbyBudget,
      }),
      handoff_needed: false,
      handoff_reason: "",
      resolved_product: catalogProducts[0]?.name || "",
    };
  }
  const image = extras.hasImage || /sent an image|screenshot|photo/i.test(String(userMessage || ""));
  if (image) {
    return {
      reply: `Thanks for the photo. I can't match a screenshot to an exact piece automatically — tell me rings, earrings, or a necklace and a budget, or WhatsApp ${wa} and our team will confirm from the picture.`,
      handoff_needed: false,
      handoff_reason: "",
      resolved_product: "",
    };
  }
  return {
    reply: `I can help with designs, prices, and store visits. Tell me rings, earrings, a necklace, or a budget — or WhatsApp ${wa}.`,
    handoff_needed: false,
    handoff_reason: "",
    resolved_product: "",
  };
}
