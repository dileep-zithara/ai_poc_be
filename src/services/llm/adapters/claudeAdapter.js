import Anthropic from "@anthropic-ai/sdk";
import { claudeUserContent } from "../media.js";

/** @param {{ apiKey: string, model: string, systemPrompt: string, tool: object, messages: Array, media?: object }} args */
export async function callClaude({ apiKey, model, systemPrompt, tool, messages, media }) {
  const client = new Anthropic({ apiKey });
  const payload = messages.map((row, index) => {
    const last = index === messages.length - 1 && row.role === "user";
    return {
      role: row.role,
      content: last ? claudeUserContent(row.content, media) : row.content,
    };
  });
  const response = await client.messages.create({
    model,
    max_tokens: 700,
    system: systemPrompt,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: payload,
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a tool call");
  return toolUse.input;
}
