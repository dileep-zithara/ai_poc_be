import OpenAI from "openai";
import { openAIUserContent } from "../media.js";

/**
 * Works for any OpenAI-compatible chat completions API — OpenAI itself,
 * DeepSeek, Qwen (DashScope compatible-mode), and any future "custom"
 * self-hosted/OpenAI-compatible endpoint.
 * @param {{ apiKey: string, baseURL?: string, model: string, systemPrompt: string, tool: object, messages: Array }} args
 */
export async function callOpenAICompatible({ apiKey, baseURL, model, systemPrompt, tool, messages, media }) {
  const client = new OpenAI({ apiKey, baseURL: baseURL || undefined });
  const chatMessages = messages.map((row, index) => {
    const last = index === messages.length - 1 && row.role === "user";
    return {
      role: row.role,
      content: last ? openAIUserContent(row.content, media) : row.content,
    };
  });

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
    tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
    tool_choice: { type: "function", function: { name: tool.name } },
  });

  const call = response.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("Model did not return a tool call");
  return JSON.parse(call.function.arguments);
}
