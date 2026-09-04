// Registry of supported LLM providers. To add a new one: add an entry here
// (and a new adapter in ./adapters/ if it doesn't speak an existing "kind"
// protocol) — the UI and /api/model-config routes pick this up automatically.
export const PROVIDERS = {
  claude: {
    label: "Claude (Anthropic)",
    kind: "anthropic",
    defaultBaseURL: null,
    models: ["claude-sonnet-4-6", "claude-opus-4-1", "claude-3-5-haiku-20241022"],
    envKey: "ANTHROPIC_API_KEY",
  },
  chatgpt: {
    label: "ChatGPT (OpenAI)",
    kind: "openai",
    defaultBaseURL: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
    envKey: "OPENAI_API_KEY",
  },
  deepseek: {
    label: "DeepSeek",
    kind: "openai",
    defaultBaseURL: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
    envKey: "DEEPSEEK_API_KEY",
  },
  qwen: {
    label: "Qwen (Alibaba)",
    kind: "openai",
    defaultBaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
    envKey: "QWEN_API_KEY",
  },
  gemini: {
    label: "Gemini (Google)",
    kind: "gemini",
    defaultBaseURL: null,
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
    envKey: "GEMINI_API_KEY",
  },
  custom: {
    label: "Custom",
    kind: "openai",
    defaultBaseURL: "",
    models: [],
    envKey: "CUSTOM_LLM_API_KEY",
  },
};

export function isKnownProvider(id) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, id);
}
