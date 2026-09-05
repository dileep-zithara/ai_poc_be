import Fuse from "fuse.js";
import { KBChunk } from "../models/KBChunk.js";
import { QueryTypes } from "sequelize";
import { databaseCapabilities, sequelize } from "../models/index.js";
import { embedText, embeddingsConfigured } from "./embeddingService.js";

let fuse = null;

// Ultra-short queries (e.g. "pp", "wt") fuzzy-match almost anything with a
// deceptively low score — verified against real customer logs that "pp"
// matches unrelated shipping/ID questions. Real product shorthand like
// this needs ad/conversation context to resolve, not KB text search.
const MIN_QUERY_LENGTH = 5;

export async function buildKBIndex() {
  const chunks = await KBChunk.findAll();
  const items = chunks.map((c) => c.toJSON());
  fuse = new Fuse(items, {
    keys: [
      { name: "question", weight: 0.5 },
      { name: "content", weight: 0.35 },
      { name: "section", weight: 0.15 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
  });
  console.log(`[kbIndex] indexed ${chunks.length} chunks`);
  return chunks.length;
}

/** Retrieve top-N KB chunks for a query. Rebuild the index after any ingestion. */
const POLICY_QUERY = /\b(return|refund|ship|store|polki|buyback|voucher|cancel|duty|track|care|hallmark)\b/i;

export async function retrieveKB(query, limit = 6) {
  if (!fuse) return [];
  const text = String(query || "").trim();
  if (text.length < MIN_QUERY_LENGTH && !POLICY_QUERY.test(text)) return [];

  if (databaseCapabilities.isPostgres && embeddingsConfigured()) {
    const embedding = await embedText(text);
    if (embedding) {
      const vector = `[${embedding.join(",")}]`;
      return sequelize.query(
        `SELECT *, 1 - ("embedding" <=> :vector::vector) AS similarity
         FROM "KBChunks"
         WHERE "embedding" IS NOT NULL
         ORDER BY "embedding" <=> :vector::vector
         LIMIT :limit`,
        { replacements: { vector, limit }, type: QueryTypes.SELECT }
      );
    }
  }

  return fuse.search(text, { limit }).map((r) => r.item);
}

export function kbIndexReady() {
  return fuse !== null;
}

export function kbHasChunks() {
  return Boolean(fuse);
}

