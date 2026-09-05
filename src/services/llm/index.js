import { PROVIDERS } from "./providers.js";
import { callClaude } from "./adapters/claudeAdapter.js";
import { callOpenAICompatible } from "./adapters/openAICompatAdapter.js";
import { callGemini } from "./adapters/geminiAdapter.js";
import { getFallbackChain } from "../modelConfigService.js";

function callByKind(kind, args) {
  switch (kind) {
    case "anthropic":
      return callClaude(args);
    case "openai":
      return callOpenAICompatible(args);
    case "gemini":
      return callGemini(args);
    default:
      throw new Error(`Unsupported provider kind: ${kind}`);
  }
}

/** Rate limits/5xx/timeouts are worth one quick retry before giving up on a provider. */
function isTransient(err) {
  const status = err?.status || err?.response?.status;
  if (status && (status === 429 || status >= 500)) return true;
  return /timeout|ECONNRESET|ETIMEDOUT|network/i.test(err?.message || "");
}

async function callWithRetry(kind, args, retries = 1) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callByKind(kind, args);
    } catch (err) {
      if (attempt >= retries || !isTransient(err)) throw err;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
}

/**
 * Tries the active provider first, then automatically fails over to any
 * other provider with a saved API key — so one provider being down,
 * rate-limited, or misconfigured doesn't take the whole chat down.
 * @param {{ systemPrompt: string, tool: object, messages: Array }} args
 */
export async function callLLM({ systemPrompt, tool, messages, media = null }) {
  const chain = await getFallbackChain();
  if (chain.length === 0) throw new Error("No LLM provider has an API key configured");

  const errors = [];
  for (const entry of chain) {
    try {
      return await callWithRetry(PROVIDERS[entry.provider].kind, {
        apiKey: entry.apiKey,
        baseURL: entry.baseURL,
        model: entry.model,
        systemPrompt,
        tool,
        messages,
        media,
      });
    } catch (err) {
      console.error(`[llm] provider "${entry.provider}" failed:`, err.message);
      errors.push(`${entry.provider}: ${err.message}`);
    }
  }
  throw new Error(`All configured providers failed — ${errors.join(" | ")}`);
}

