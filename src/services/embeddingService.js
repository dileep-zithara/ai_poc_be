import OpenAI from "openai";

const provider = process.env.EMBEDDING_PROVIDER || "";
const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || "";

let client = null;

export function embeddingsConfigured() {
  return provider === "openai" && Boolean(apiKey);
}

function openAIClient() {
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export async function embedTexts(texts) {
  if (!embeddingsConfigured()) return [];
  const response = await openAIClient().embeddings.create({ model, input: texts });
  return response.data.map((item) => item.embedding);
}

export async function embedText(text) {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

export function chunkText(chunk) {
  return [chunk.section, chunk.question, chunk.content].filter(Boolean).join("\n");
}
