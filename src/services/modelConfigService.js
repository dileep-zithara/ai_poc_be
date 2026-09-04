import { ModelConfig } from "../models/ModelConfig.js";
import { ProviderCredential } from "../models/ProviderCredential.js";
import { PROVIDERS } from "./llm/providers.js";

const SINGLETON_ID = 1;

async function resolveCredential(providerId) {
  const provider = PROVIDERS[providerId];
  if (!provider) return null;
  const cred = await ProviderCredential.findOne({ where: { provider: providerId } });
  const apiKey = cred?.apiKey || process.env[provider.envKey] || "";
  const baseURL = cred?.baseURL || provider.defaultBaseURL || "";
  return apiKey ? { provider: providerId, apiKey, baseURL } : null;
}

export async function getActiveSelection() {
  let row = await ModelConfig.findByPk(SINGLETON_ID);
  if (!row) row = await ModelConfig.create({ id: SINGLETON_ID });
  return { provider: row.provider, model: row.model };
}

/** Switches which provider/model is primary. Does not touch API keys. */
export async function setActiveSelection({ provider, model }) {
  let row = await ModelConfig.findByPk(SINGLETON_ID);
  if (!row) row = ModelConfig.build({ id: SINGLETON_ID });
  row.provider = provider;
  row.model = model;
  await row.save();
  return row;
}

/** Saves/updates one provider's key without affecting which provider is active. */
export async function saveCredential({ provider, apiKey, baseURL }) {
  let row = await ProviderCredential.findOne({ where: { provider } });
  if (!row) row = ProviderCredential.build({ provider });
  if (apiKey !== undefined) row.apiKey = apiKey;
  if (baseURL !== undefined) row.baseURL = baseURL;
  await row.save();
  return row;
}

/** Per-provider status for the Model Settings UI: which ones are ready to serve/fail over to. */
export async function listProviderStatus() {
  const creds = await ProviderCredential.findAll();
  const byId = Object.fromEntries(creds.map((c) => [c.provider, c]));
  return Object.keys(PROVIDERS).map((id) => {
    const provider = PROVIDERS[id];
    const hasApiKey = !!(byId[id]?.apiKey || process.env[provider.envKey]);
    return { id, hasApiKey, baseURL: byId[id]?.baseURL || provider.defaultBaseURL || "" };
  });
}

/**
 * Ordered list of {provider, model, apiKey, baseURL} to try for a chat
 * call: the active selection first, then every other provider that has a
 * saved (or env) key, using its first known model. This is what lets one
 * provider being down/rate-limited/misconfigured not take the whole chat
 * down — see llm/index.js.
 */
export async function getFallbackChain() {
  const active = await getActiveSelection();
  const chain = [];

  const activeCred = await resolveCredential(active.provider);
  if (activeCred) chain.push({ ...activeCred, model: active.model });

  for (const id of Object.keys(PROVIDERS)) {
    if (id === active.provider) continue;
    const cred = await resolveCredential(id);
    if (cred) chain.push({ ...cred, model: PROVIDERS[id].models[0] || "" });
  }
  return chain;
}

