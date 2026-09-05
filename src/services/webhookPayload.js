function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unwrap(payload) {
  const root = asObject(payload) || {};
  if (asObject(root.data) && (root.event || root.event_type || root.data.entry || root.data.object)) {
    return { wrapper: root, body: root.data };
  }
  return { wrapper: null, body: root };
}

function first(list) {
  return Array.isArray(list) && list.length ? list[0] : null;
}

function skip(channel, reason, extras = {}) {
  return { skip: true, skipReason: reason, channel, message: "", phone: null, customerName: null, referral: null, attachment: null, ...extras };
}

function ok(channel, fields) {
  return { skip: false, channel, message: "", phone: null, customerName: null, referral: null, attachment: null, ...fields };
}

export function firstNameFromProfile(name) {
  const cleaned = String(name || "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[_./]+/g, " ")
    .trim();
  if (!cleaned || /^\+?\d[\d\s-]{7,}$/.test(cleaned)) return null;
  const first = cleaned.split(/\s+/)[0];
  if (first.length < 2 || first.length > 24) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function waReferral(ref) {
  if (!asObject(ref)) return null;
  return {
    adId: ref.source_id || ref.ad_id || null,
    sourceType: ref.source_type || "ad",
    headline: ref.headline || "",
    body: ref.body || "",
    imageUrl: ref.image_url || ref.thumbnail_url || "",
    videoUrl: ref.video_url || "",
    welcomeText: ref.welcome_message?.text || "",
    sourceUrl: ref.source_url || "",
  };
}

function messengerReferral(ref) {
  if (!asObject(ref)) return null;
  const ads = asObject(ref.ads_context_data) || {};
  return {
    adId: ref.ad_id || ref.source_id || null,
    sourceType: ref.source || ref.type || "ADS",
    headline: ads.ad_title || ref.headline || "",
    body: ads.ad_body || ref.body || "",
    imageUrl: ads.photo_url || ads.image_url || ref.image_url || "",
    videoUrl: ads.video_url || ref.video_url || "",
    welcomeText: "",
    sourceUrl: ads.post_id || "",
  };
}

function parseWhatsAppMessage(msg, phoneFromContact, profileName) {
  const type = String(msg.type || "text");
  const phone = msg.from || phoneFromContact || null;
  const customerName = profileName || msg.profile?.name || null;
  const wmaid = msg.wmaid || msg.wamid || msg.id || null;
  const referral = waReferral(msg.referral);
  let message = "";
  let attachment = null;

  if (type === "text") message = msg.text?.body || "";
  else if (type === "button") message = msg.button?.text || msg.button?.payload || "";
  else if (type === "interactive" && msg.interactive?.type === "button_reply") {
    message = msg.interactive.button_reply?.title || "";
  } else if (type === "interactive" && msg.interactive?.type === "list_reply") {
    message = msg.interactive.list_reply?.title || "";
  } else if (type === "reaction") {
    return skip("whatsapp", "reaction", { phone, event: "reaction" });
  } else if (type === "unsupported") {
    return skip("whatsapp", "unsupported_message", { phone, event: "unsupported" });
  } else if (type === "contacts") {
    const contact = first(msg.contacts);
    message = contact?.name?.formatted_name
      ? `[Customer shared a contact: ${contact.name.formatted_name}${contact.phones?.[0]?.phone ? ` ${contact.phones[0].phone}` : ""}]`
      : "[Customer shared a contact]";
  } else if (type === "location") {
    const loc = msg.location || {};
    message = `[Customer shared a location${loc.latitude != null ? ` ${loc.latitude}, ${loc.longitude}` : ""}]`;
  } else if (["image", "audio", "video", "document", "sticker"].includes(type)) {
    const media = msg[type] || {};
    attachment = { type: type === "sticker" ? "image" : type, name: media.filename || media.caption || type };
    message = media.caption || "";
  }

  if (!message && referral) message = referral.welcomeText || "Hi";
  return ok("whatsapp", { message, phone, customerName, referral, attachment, event: type, wmaid });
}

function parseWhatsAppWrapped(body) {
  const change = first(first(body.entry)?.changes);
  const value = change?.value || {};
  const msg = first(value.messages);
  if (!msg) return skip("whatsapp", "no_inbound_message", { event: change?.field || "whatsapp" });
  const contact = first(value.contacts);
  const phone = contact?.wa_id || msg.from;
  return parseWhatsAppMessage(msg, phone, contact?.profile?.name || null);
}

function parseMessengerEvent(body, wrapper) {
  const channel = wrapper?.event === "InstagramWebhook.Received" || body.object === "instagram" || wrapper?.event_type
    ? "instagram"
    : "facebook";
  const entry = first(body.entry) || {};
  const messaging = first(entry.messaging);

  if (first(entry.changes)?.field === "comments") {
    const value = first(entry.changes).value || {};
    const mediaType = value.media?.media_product_type || "";
    return ok("instagram", {
      message: value.text || "",
      phone: null,
      customerName: value.from?.username || value.from?.name || null,
      customerId: value.from?.id || null,
      referral: mediaType === "AD" ? { adId: value.media?.id || null, sourceType: "AD_COMMENT", headline: "", body: "", imageUrl: "", videoUrl: "", welcomeText: "" } : null,
      event: "comment",
      attachment: null,
    });
  }

  if (!messaging) return { error: "No messaging or comment event in payload" };
  if (messaging.delivery) return skip(channel, "delivery_receipt", { event: "delivery" });
  if (messaging.read) return skip(channel, "read_receipt", { event: "read" });

  const standaloneRef = messengerReferral(messaging.referral);
  const msg = messaging.message;
  if (!msg && standaloneRef) {
    return ok(channel, {
      message: "Hi",
      phone: null,
      customerName: messaging.sender?.name || messaging.sender?.username || null,
      customerId: messaging.sender?.id,
      referral: standaloneRef,
      event: "ad_referral",
    });
  }
  if (!msg) return skip(channel, "no_inbound_message", { event: "unknown" });
  if (msg.is_echo) return skip(channel, "outbound_echo", { event: "echo" });
  if (msg.is_deleted) return skip(channel, "message_deleted", { event: "deleted" });

  const referral = messengerReferral(msg.referral) || standaloneRef;
  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
  const firstAtt = first(attachments);
  let attachment = null;
  if (firstAtt?.type) {
    const kind = firstAtt.type === "ig_story" || firstAtt.type === "story_mention" || firstAtt.type === "ig_post" || firstAtt.type === "ig_reel"
      ? "image"
      : firstAtt.type;
    attachment = { type: kind === "template" ? "image" : kind, name: firstAtt.type };
  }

  let message = msg.text || "";
  if (!message && firstAtt?.type === "ig_reel") message = `[Customer shared a reel${firstAtt.payload?.url ? `: ${firstAtt.payload.url}` : ""}]`;
  if (!message && firstAtt?.type === "ig_post") message = "[Customer shared a post]";
  if (!message && firstAtt?.type === "ig_story") message = "[Customer replied to a story]";
  if (!message && firstAtt?.type === "story_mention") message = "[Customer mentioned you in a story]";
  if (!message && firstAtt?.type === "image") message = "";
  if (!message && referral) message = "Hi";
  if (!message && attachment) message = `[Customer sent ${attachment.name}]`;

  return ok(channel, {
    message,
    phone: null,
    customerName: messaging.sender?.name || messaging.sender?.username || null,
    customerId: messaging.sender?.id || null,
    referral,
    attachment,
    event: referral ? "ad_referral" : (firstAtt?.type || "text"),
  });
}

export function parseWebhook(payload) {
  if (!asObject(payload)) return { error: "Webhook JSON must be an object" };
  const { wrapper, body } = unwrap(payload);

  if (body.object === "whatsapp_business_account" || first(body.entry)?.changes?.[0]?.value?.messaging_product === "whatsapp") {
    return parseWhatsAppWrapped(body);
  }
  if (payload.from && payload.type) return parseWhatsAppMessage(payload);
  if (body.object === "whatsapp_business_account") return parseWhatsAppWrapped(body);

  if (
    wrapper?.event === "InstagramWebhook.Received"
    || wrapper?.event_type
    || body.object === "instagram"
    || body.object === "page"
    || first(body.entry)?.messaging
    || first(body.entry)?.changes
  ) {
    return parseMessengerEvent(body, wrapper);
  }

  if (payload.from && (payload.text || payload.referral || payload.image)) {
    return parseWhatsAppMessage({ ...payload, type: payload.type || "text" });
  }

  return { error: "Unrecognized webhook. Paste a WhatsApp, Instagram, or Facebook inbound payload." };
}
