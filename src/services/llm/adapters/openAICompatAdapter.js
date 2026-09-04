import OpenAI from "openai";

/**
 * Works for any OpenAI-compatible chat completions API — OpenAI itself,
 * DeepSeek, Qwen (DashScope compatible-mode), and any future "custom"
 * self-hosted/OpenAI-compatible endpoint.
 * @param {{ apiKey: string, baseURL?: string, model: string, systemPrompt: string, tool: object, messages: Array }} args
 */
export async function callOpenAICompatible({ apiKey, baseURL, model, systemPrompt, tool, messages }) {
  const client = new OpenAI({ apiKey, baseURL: baseURL || undefined });

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
    tool_choice: { type: "function", function: { name: tool.name } },
  });

  const call = response.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("Model did not return a tool call");
  return JSON.parse(call.function.arguments);
}
