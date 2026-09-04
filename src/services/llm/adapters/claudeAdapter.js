import Anthropic from "@anthropic-ai/sdk";

/** @param {{ apiKey: string, model: string, systemPrompt: string, tool: object, messages: Array }} args */
export async function callClaude({ apiKey, model, systemPrompt, tool, messages }) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 700,
    system: systemPrompt,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages,
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a tool call");
  return toolUse.input;
}
