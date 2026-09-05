import "dotenv/config";

// Per-provider API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.) are read
// directly from process.env by modelConfigService.js as a fallback when no
// key is saved via the Model Settings UI — see services/llm/providers.js.
/** Central WhatsApp / callback line — used for stores, screenshots, and LLM fallback. */
export const CENTRAL_WHATSAPP = String(process.env.CENTRAL_WHATSAPP || "7275724262").replace(/\D/g, "").slice(-10) || "7275724262";

export function displayWhatsApp(number = CENTRAL_WHATSAPP) {
  const digits = String(number || "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return number || "";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export const config = {
  port: process.env.PORT || 4200,
  // Read-only zithara_prod (Tyaani catalog / ads / referrals). Separate from
  // DATABASE_URL, which is this service's own SQLite/Postgres.
  zitharaProdUrl: process.env.ZITHARA_PROD_DATABASE_URL || "",
  zitharaProdSsl: process.env.ZITHARA_PROD_SSL === "true",
  tyaaniMerchantId: process.env.TYAANI_MERCHANT_ID || "ac96e470-bf6e-43c1-8e31-e80033c81580",
  centralWhatsapp: CENTRAL_WHATSAPP,
};
