import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { geminiParts } from "../media.js";

// Converts our JSON-Schema-style tool.input_schema into Gemini's Schema format.
function toGeminiSchema(schema) {
  if (schema.type === "object") {
    const properties = {};
    for (const [key, value] of Object.entries(schema.properties || {})) {
      properties[key] = toGeminiSchema(value);
    }
    return { type: SchemaType.OBJECT, properties, required: schema.required || [] };
  }
  if (schema.type === "boolean") return { type: SchemaType.BOOLEAN, description: schema.description };
  return { type: SchemaType.STRING, description: schema.description };
}

/** @param {{ apiKey: string, model: string, systemPrompt: string, tool: object, messages: Array, media?: object }} args */
export async function callGemini({ apiKey, model, systemPrompt, tool, messages, media }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: [{ name: tool.name, description: tool.description, parameters: toGeminiSchema(tool.input_schema) }] }],
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [tool.name] } },
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const last = messages[messages.length - 1];

  const chat = geminiModel.startChat({ history });
  const result = await chat.sendMessage(geminiParts(last.content, media));
  const call = result.response.functionCalls()?.[0];
  if (!call) throw new Error("Gemini did not return a function call");
  return call.args;
}
