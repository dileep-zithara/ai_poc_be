import "dotenv/config";

// Per-provider API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.) are read
// directly from process.env by modelConfigService.js as a fallback when no
// key is saved via the Model Settings UI — see services/llm/providers.js.
export const config = {
  port: process.env.PORT || 4200,
  // Read-only zithara_prod (Tyaani catalog / ads / referrals). Separate from
  // DATABASE_URL, which is this service's own SQLite/Postgres.
  zitharaProdUrl: process.env.ZITHARA_PROD_DATABASE_URL || "",
  zitharaProdSsl: process.env.ZITHARA_PROD_SSL === "true",
  tyaaniMerchantId: process.env.TYAANI_MERCHANT_ID || "ac96e470-bf6e-43c1-8e31-e80033c81580",
};
