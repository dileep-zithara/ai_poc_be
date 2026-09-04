import { Router } from "express";
import { Conversation } from "../models/Conversation.js";
import { retrieveKB, kbIndexReady } from "../services/kbIndex.js";
import { generateResponse } from "../services/llmService.js";
import { findAdContext } from "./adContext.js";
import { getAgentSettings } from "./agentSettings.js";
import { catalogReplyMissesProducts, filterByBudget, formatCatalogPriceReply, getAdReferralContext, getProductsByNames, listFeaturedCatalogProducts, searchCatalogProducts, shouldSearchCatalog, zitharaProdConfigured } from "../services/zitharaProd.js";
import {
  catalogQueryForSession,
  parseMessageSignals,
  phonePolicy,
  readSession,
  updateSessionContext,
  wantsStoreInfo,
} from "../services/sessionContext.js";
import { findStore, formatStore, storeBlock } from "../services/storeDirectory.js";
import { parseWebhook } from "../services/webhookPayload.js";

const router = Router();

function policyKbChunks(chunks) {
  return (chunks || []).filter((c) => /faq|ship|return|store|polic|hour|buyback|certif|about|contact/i.test(`${c.section} ${c.content || ""} ${c.question || ""}`));
}

router.post("/", async (req, res) => {
  try {
    let { sessionId = "anonymous", message, adId, cardId, channel = "web", attachment, referral, customerPhone, webhook } = req.body;
    let parsedWebhook = null;
    if (webhook) {
      parsedWebhook = parseWebhook(webhook);
      if (parsedWebhook.error) return res.status(400).json({ error: parsedWebhook.error });
      if (parsedWebhook.skip) {
        return res.json({
          reply: null,
          skipped: true,
          skipReason: parsedWebhook.skipReason,
          channel: parsedWebhook.channel || channel,
          parsedWebhook,
          handoff: { needed: false },
          usedKBChunks: [],
          usedCatalogProducts: [],
        });
      }
      channel = parsedWebhook.channel || channel;
      message = parsedWebhook.message || message;
      customerPhone = parsedWebhook.phone || customerPhone;
      attachment = parsedWebhook.attachment || attachment;
      if (parsedWebhook.referral) {
        referral = {
          source_id: parsedWebhook.referral.adId,
          headline: parsedWebhook.referral.headline,
          body: parsedWebhook.referral.body,
          image_url: parsedWebhook.referral.imageUrl,
          s3_media_url: parsedWebhook.referral.imageUrl,
        };
        adId = adId || parsedWebhook.referral.adId;
      }
    }
    if (!message?.trim() && !attachment?.type) return res.status(400).json({ error: "message or attachment is required" });
    if (!kbIndexReady()) return res.status(503).json({ error: "KB not ingested yet — upload a document first" });

    const settings = await getAgentSettings();
    if (!settings.aiEnabled) {
      return res.json({ reply: null, aiPaused: true, handoff: { needed: false }, resolvedProduct: null, usedKBChunks: [], parsedWebhook });
    }

    let convo = await Conversation.findOne({ where: { sessionId } });
    if (!convo) convo = await Conversation.create({ sessionId, channel, sessionContext: "{}" });
    else if (convo.channel !== channel) convo.channel = channel;

    if (convo.handoffActive && settings.humanHandoffEnabled) {
      return res.json({
        reply: null,
        handoff: { needed: true, reason: convo.handoffReason, alreadyActive: true },
        resolvedProduct: null,
        usedKBChunks: [],
        parsedWebhook,
      });
    }

    const referralAdId = adId || referral?.source_id || null;
    let activeContext = null;
    if (referralAdId) {
      const ctx = await findAdContext(referralAdId, cardId);
      const liveAd = zitharaProdConfigured() ? await getAdReferralContext(referralAdId) : null;
      convo.activeAdId = referralAdId;
      if (ctx) convo.activeProductName = ctx.productName;
      if (ctx || liveAd || referral) {
        activeContext = {
          adId: referralAdId,
          adName: liveAd?.ad_name,
          productName: ctx?.productName,
          productPrice: ctx?.productPrice,
          productWeight: ctx?.productWeight,
          instructions: ctx?.instructions,
          referralHeadline: referral?.headline || liveAd?.creative_title,
          referralBody: referral?.body || liveAd?.creative_body,
          referralImageUrl: referral?.s3_media_url || referral?.image_url || liveAd?.thumbnail_url,
          welcomeText: parsedWebhook?.referral?.welcomeText || "",
        };
      }
    } else if (convo.activeAdId) {
      const ctx = await findAdContext(convo.activeAdId);
      const liveAd = zitharaProdConfigured() ? await getAdReferralContext(convo.activeAdId) : null;
      if (ctx || liveAd) {
        activeContext = {
          adId: convo.activeAdId,
          adName: liveAd?.ad_name,
          productName: ctx?.productName,
          productPrice: ctx?.productPrice,
          productWeight: ctx?.productWeight,
          instructions: ctx?.instructions,
          referralHeadline: liveAd?.creative_title,
          referralBody: liveAd?.creative_body,
          referralImageUrl: liveAd?.thumbnail_url,
        };
      }
    }

    const history = JSON.parse(convo.history);
    const attachmentMarker = attachment?.type
      ? `[Customer sent a${attachment.type === "image" ? "n" : ""} ${attachment.type}${attachment.name ? ` named "${attachment.name}"` : ""}]`
      : "";
    const effectiveMessage = [attachmentMarker, message?.trim()].filter(Boolean).join("\n");
    const signals = parseMessageSignals(message || "");

    let session = updateSessionContext({
      session: readSession(convo),
      channel,
      signals,
      adContext: activeContext,
      customerPhone: customerPhone || null,
      catalogProducts: [],
    });

    const plan = catalogQueryForSession(message || "", session, signals, activeContext);
    let catalogProducts = [];
    let nearbyBudget = false;
    const catalogTriggered = settings.productCatalogSearch
      && zitharaProdConfigured()
      && (shouldSearchCatalog(message, session) || Boolean(plan.categoryId) || plan.featured || plan.reuseLast || plan.preferLastShown);
    if (catalogTriggered) {
      try {
        if (plan.reuseLast && session.lastShownProducts?.length) {
          catalogProducts = await getProductsByNames(session.lastShownProducts.map((p) => p.name), 8);
          if (!catalogProducts.length) catalogProducts = session.lastShownProducts;
          catalogProducts = filterByBudget(catalogProducts, session.budgetMin, session.budgetMax);
        } else if (plan.featured) {
          catalogProducts = await listFeaturedCatalogProducts(8, {
            budgetMin: session.budgetMin,
            budgetMax: session.budgetMax,
          });
        } else {
          catalogProducts = await searchCatalogProducts(plan.query || session.category || message, 8, {
            categoryId: plan.categoryId,
            budgetMin: session.budgetMin,
            budgetMax: session.budgetMax,
            offset: plan.offset,
          });
        }
        if ((plan.preferLastShown || signals.budgetMin != null || signals.budgetMax != null) && session.lastShownProducts?.length) {
          const kept = filterByBudget(session.lastShownProducts, session.budgetMin, session.budgetMax);
          if (kept.length) {
            const fresh = await getProductsByNames(kept.map((p) => p.name), 8);
            const ranked = filterByBudget(fresh.length ? fresh : kept, session.budgetMin, session.budgetMax);
            const seen = new Set(ranked.map((p) => String(p.name || "").toLowerCase()));
            catalogProducts = [...ranked, ...catalogProducts.filter((p) => !seen.has(String(p.name || "").toLowerCase()))].slice(0, 8);
          }
        }
        if (!catalogProducts.length && (session.budgetMin || session.budgetMax) && (plan.categoryId || session.category)) {
          catalogProducts = await searchCatalogProducts(plan.categoryId || session.category, 8, {
            categoryId: plan.categoryId || session.category,
            offset: 0,
          });
          nearbyBudget = catalogProducts.length > 0;
        }
        if (signals.showMore) session.catalogOffset = (session.catalogOffset || 0) + catalogProducts.length;
      } catch (err) {
        console.error("[chat] catalog search failed:", err.message);
      }
    }

    session = updateSessionContext({
      session,
      channel,
      signals: { ...signals, showMore: false, category: null },
      adContext: activeContext,
      customerPhone: customerPhone || null,
      catalogProducts,
    });

    const rawKb = await retrieveKB(message || attachmentMarker, 6);
    const kbChunks = catalogProducts.length ? policyKbChunks(rawKb) : rawKb;
    const store = formatStore(findStore(session.city || message || "") || (session.storeId ? findStore(session.storeId) : null));
    const phone = phonePolicy(channel, session, { wantsCall: signals.scheduleCall });
    const storeText = signals.scheduleCall || wantsStoreInfo(message)
      ? storeBlock(store)
      : store
        ? `STORE NOTE: session city is ${store.city}. Do not mention the store, address, hours, or a callback unless they asked.`
        : "STORE NOTE: city unknown. Do not ask for their city or offer a call unless they asked about a store or a callback.";

    const result = await generateResponse(effectiveMessage, kbChunks, activeContext, history, catalogProducts, {
      session,
      store,
      storeText,
      phone,
      catalogPrimary: catalogProducts.length > 0,
      nearbyBudget,
    });

    const askedForHuman = /\b(agent|human|person|executive|talk to (someone|a person))\b/i.test(message || "");
    const playgroundSession = String(sessionId).startsWith("playground-");
    if (result.handoff_needed && !askedForHuman && (catalogProducts.length || signals.category)) {
      result.handoff_needed = false;
      result.handoff_reason = "";
    }
    if (playgroundSession) {
      result.handoff_needed = false;
      result.handoff_reason = "";
    }

    if (catalogProducts.length && catalogReplyMissesProducts(result.reply, catalogProducts)) {
      result.reply = formatCatalogPriceReply(catalogProducts, {
        hasAd: Boolean(activeContext?.adId || activeContext?.productName),
        hasAdProduct: Boolean(activeContext?.productName),
        offer: activeContext?.referralHeadline || "",
        budgetMin: session.budgetMin,
        budgetMax: session.budgetMax,
        nearbyBudget,
      });
      result.handoff_needed = false;
      result.handoff_reason = "";
    }

    history.push({ role: "user", content: effectiveMessage });
    history.push({ role: "assistant", content: result.reply });
    if (history.length > 24) history.splice(0, history.length - 24);

    convo.history = JSON.stringify(history);
    convo.sessionContext = JSON.stringify(session);
    if (result.handoff_needed && settings.humanHandoffEnabled && !playgroundSession) {
      convo.handoffActive = true;
      convo.handoffReason = result.handoff_reason;
    }
    await convo.save();

    res.json({
      reply: result.reply,
      channel: convo.channel,
      shadowMode: settings.shadowMode,
      handoff: result.handoff_needed && settings.humanHandoffEnabled ? { needed: true, reason: result.handoff_reason } : { needed: false },
      resolvedProduct: result.resolved_product || null,
      usedKBChunks: kbChunks.map((c) => ({ section: c.section, question: c.question })),
      usedCatalogProducts: catalogProducts.map((p) => ({ name: p.name, price: p.price, url: p.url, category: p.category, imageUrl: p.image_url })),
      session,
      parsedWebhook,
    });
  } catch (err) {
    console.error("[chat] error:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

router.post("/reset", async (req, res) => {
  const { sessionId = "anonymous" } = req.body;
  await Conversation.destroy({ where: { sessionId } });
  res.json({ ok: true });
});

export default router;
