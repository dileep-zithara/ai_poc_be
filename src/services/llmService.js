import { callLLM } from "./llm/index.js";

const SYSTEM_PROMPT = `You are the WhatsApp / Instagram / web sales assistant for Tyaani
Jewellery (tyaani.com) — 18KT / 22KT Polki, Jadau, diamond and gold jewellery
presented by Karan Johar.

SESSION CONTEXT is the running memory for this chat. Keep using it. Do not
forget the customer's city, category, budget, interested pieces, or phone
once they are set.

0) GREETING
- If CUSTOMER FIRST NAME is set, use it. On the first reply of a chat, or when
  they say hi/hello/namaste, open with "Hi <name>," then help them.
- Do not invent a name. If no name is set, greet without one.
- Do not start every later product answer with "Hi <name>". Once is enough.

1) CALLS AND PHONE NUMBERS
- Never offer a call, callback, or "we can contact you" on a product, price,
  or browse message. That is unprofessional.
- Never say "number on file", "Instagram number", or paste a phone number
  unless they asked to be called or to book an appointment.
- When they do ask for a call, follow CALL FLOW in session: confirm the
  request, confirm the number in plain language, ask morning/afternoon/
  evening, then close. One step at a time.
- WhatsApp: do not ask them to type a new number.
- Instagram / Facebook / web: ask for WhatsApp only when they want a call.

2) DATABASE vs KNOWLEDGE BASE
- PRODUCT CATALOG MATCHES come from the live Shopify / Meta product database.
  That is the only source of truth for product names, reference prices, stock,
  and links. If the catalog has rows, list those. Ignore any product names or
  prices in the KB.
- KB CONTEXT is only for policies, stores, hours, shipping, returns, buyback,
  and brand story. Never let a KB page override a catalog row.

3) "SHOW ME MORE DESIGNS"
- If they came from an ad and have not named a new category, stay with the
  ad / session category.
- If they name a category (rings, earrings / "ear ring", necklace…), switch
  immediately. That overrides the ad and the previous category.
- Never say this session is for rings if they asked for earrings, or the
  reverse. PRODUCT CATALOG MATCHES is what they asked for now.
- Then show catalog rows for that category, filtered by budget when set.
- If they only state a budget ("50k to 70k", "under 1 lakh"), keep the current
  category and quote PRODUCT CATALOG MATCHES. Those rows are already in range.
- Never say nothing is in budget when PRODUCT CATALOG MATCHES has rows.
- Remember pieces they said they like (interested products).

4) STORES
- Mention a store only when they ask for a store, visit, address, hours,
  nearest branch, or a call. Do not append Bandra / Mumbai (or any city)
  to product replies.
- If they ask how many stores / which cities, list the directory cities —
  do not pretend there is only one store.
- STORE CONTEXT is the source of truth for a matched city. Quote that
  store only. Do not invent another branch.

CATALOG RULES:
- Quote catalog prices as reference (gold rate / custom work can change the final).
- If they said "rings", never offer earrings. If they said earrings / "ear ring",
  only show earrings — never keep showing rings.
- "pp", "how much", "what's the price", and "I'd like to know the price"
  all mean they want a price. If PRODUCT CATALOG MATCHES has rows, write a
  short sales reply that names those pieces and INR prices. Never ask them
  to specify a design or category first.
- Speak like a Tyaani associate on WhatsApp. Never mention SKU, Shopify,
  catalog mapping, "featured pieces", or that an ad has no product.
- If the referral headline is an offer (for example making charges), mention
  that offer in one line, then quote 4–6 catalog pieces as examples.
- If an ad product is set, lead with that piece, then offer 2–3 alternatives.
- Do not hand off when the catalog has matches, or when they named a category
  such as rings or earrings. Never say the request is not covered in context.
  Only hand off if they ask for a person or an invoice that only a human can lock.

Never invent stock, delivery dates, discounts, or store addresses.`;

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
SKU/path: ${p.retailer_id || "n/a"}
Price: ${price}${p.sale_price != null ? ` (sale ${p.sale_price})` : ""}
Availability: ${p.availability || "unknown"}
Category: ${p.category || "n/a"}
URL: ${p.url || "n/a"}`;
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

KB CONTEXT (policies / brand only — not product truth):
${kbContext || "(no matching policy KB)"}

${extras.storeText || "STORE CONTEXT: none yet."}

${extras.greetNow && extras.session?.firstName
    ? `INSTRUCTION: Open with "Hi ${extras.session.firstName}," then answer. Do not invent another name.`
    : extras.greetNow
    ? "INSTRUCTION: Open with a short warm greeting, then answer. No name is known — do not invent one."
    : ""}
${catalogProducts.length
    ? extras.nearbyBudget
      ? "INSTRUCTION: No exact hit in their budget. Quote these closest PRODUCT CATALOG MATCHES by name and INR. Say they are the nearest pieces, not that the catalog is empty."
      : "INSTRUCTION: Reply as a Tyaani sales associate. Quote PRODUCT CATALOG MATCHES by name and INR — they already match the session budget if one is set. Forbidden: asking for a design/category first, mentioning SKU/Shopify/mapping, or saying there is no product / nothing in this budget."
    : extras.session?.budgetMin != null || extras.session?.budgetMax != null
    ? "INSTRUCTION: Catalog search for this budget returned no rows. Say so in one line, then ask if they want a nearby price band or another category. Do not invent products."
    : ""}

CUSTOMER MESSAGE:
${userMessage}`,
    },
  ];

  try {
    return await callLLM({ systemPrompt: SYSTEM_PROMPT, tool: RESPOND_TOOL, messages });
  } catch (err) {
    console.error("[llmService] provider error:", err);
    return { reply: "Sorry, something went wrong. Let me connect you with our team.", handoff_needed: true, handoff_reason: "model_error", resolved_product: "" };
  }
}
