const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function attachmentMedia(attachment) {
  if (!attachment?.data || !attachment.type) return null;
  const data = String(attachment.data).replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  if (!data || data.length > 12_000_000) return null;
  const mimeType = String(attachment.mimeType || defaultMime(attachment.type)).toLowerCase();
  return { type: attachment.type, mimeType, data };
}

function defaultMime(type) {
  if (type === "image") return "image/jpeg";
  if (type === "audio") return "audio/mpeg";
  if (type === "video") return "video/mp4";
  return "application/octet-stream";
}

export function claudeUserContent(text, media) {
  if (media?.type === "image" && IMAGE_TYPES.has(media.mimeType)) {
    return [
      { type: "image", source: { type: "base64", media_type: media.mimeType, data: media.data } },
      { type: "text", text },
    ];
  }
  return text;
}

export function openAIUserContent(text, media) {
  if (media?.type === "image" && IMAGE_TYPES.has(media.mimeType)) {
    return [
      { type: "text", text },
      { type: "image_url", image_url: { url: `data:${media.mimeType};base64,${media.data}` } },
    ];
  }
  return text;
}

export function geminiParts(text, media) {
  const parts = [{ text }];
  if (media?.data && media.mimeType) {
    parts.push({ inlineData: { mimeType: media.mimeType, data: media.data } });
  }
  return parts;
}
