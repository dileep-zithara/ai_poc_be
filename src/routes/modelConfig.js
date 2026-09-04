import { Router } from "express";
import { PROVIDERS } from "../services/llm/providers.js";
import { getActiveSelection, setActiveSelection, saveCredential, listProviderStatus } from "../services/modelConfigService.js";

const router = Router();

/** List of supported providers + their known models, for the Model Settings dropdowns. */
router.get("/providers", (_req, res) => {
  const providers = Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label: p.label,
    models: p.models,
    defaultBaseURL: p.defaultBaseURL,
    // openai-compatible providers (and "custom") accept any model name, not just the presets listed
    allowCustomModel: p.kind === "openai",
    allowBaseURLOverride: p.kind === "openai",
  }));
  res.json(providers);
});

/** Active provider/model, plus per-provider key status — any provider with hasApiKey=true is used as an automatic fallback. */
router.get("/", async (_req, res) => {
  const active = await getActiveSelection();
  const providers = await listProviderStatus();
  res.json({ ...active, providers });
});

/** Save/update one provider's API key + base URL without changing which provider is active. */
router.put("/credentials/:provider", async (req, res) => {
  const { provider } = req.params;
  if (!PROVIDERS[provider]) return res.status(400).json({ error: "Unknown provider" });

  const { apiKey, baseURL } = req.body;
  await saveCredential({ provider, apiKey, baseURL });
  res.json({ providers: await listProviderStatus() });
});

/** Switch which provider/model is primary for new chat calls. */
router.put("/active", async (req, res) => {
  const { provider, model } = req.body;
  if (!provider || !PROVIDERS[provider]) return res.status(400).json({ error: "Unknown provider" });
  if (!model?.trim()) return res.status(400).json({ error: "model is required" });

  const row = await setActiveSelection({ provider, model });
  res.json({ provider: row.provider, model: row.model });
});

export default router;

