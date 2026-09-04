import fs from "fs/promises";
import mammoth from "mammoth";
import { KBChunk } from "../models/KBChunk.js";
import { sequelize } from "../models/index.js";
import { chunkText, embedTexts, embeddingsConfigured } from "./embeddingService.js";

/**
 * The real KB doc (Tyani_Combined_KB.docx) is written almost entirely as
 * "Q: <question> A: <answer>" lines, with occasional section headers and
 * prose paragraphs (brand story, guardrails). Chunking naively by
 * paragraph or by fixed character windows breaks a Q&A pair apart from
 * its answer, or fuses unrelated Q&As together — both hurt retrieval.
 * This chunker instead:
 *   - keeps every "Q: ... A: ..." as ONE self-contained chunk
 *   - tracks the nearest heading as that chunk's "section", so retrieval
 *     results carry context (e.g. "SHIPPING & DELIVERY")
 *   - treats non-Q&A paragraphs (brand story, guardrails list) as their
 *     own prose chunks, tagged to their section
 */

const QA_PATTERN = /^Q:\s*(.+?)\s*A:\s*(.+)$/s;

function looksLikeHeading(line) {
  if (line.length > 80) return false;
  if (QA_PATTERN.test(line)) return false;
  if (/:/.test(line)) return false; // "Colors: ...", "Purpose: ..." are label lines, not headings
  // Headings in this doc are short, often numbered or ALL-CAPS-ish, no trailing period.
  const endsLikeSentence = /[.?!]\s*$/.test(line);
  const isNumbered = /^\d+(\.\d+)?\s/.test(line);
  const isUpperish = line === line.toUpperCase() && /[A-Z]/.test(line);
  return !endsLikeSentence && (isNumbered || isUpperish);
}

export async function ingestDocx(filePath, sourceDocLabel) {
  const { value: rawText } = await mammoth.extractRawText({ path: filePath });
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let currentSection = "General";
  const chunks = [];

  for (const line of lines) {
    const qaMatch = line.match(QA_PATTERN);
    if (qaMatch) {
      chunks.push({
        type: "qa",
        section: currentSection,
        question: qaMatch[1].trim(),
        content: qaMatch[2].trim(),
      });
      continue;
    }

    if (looksLikeHeading(line)) {
      currentSection = line;
      continue; // headings aren't retrievable content on their own
    }

    // Prose paragraph (brand story, guardrails, policy prose not in Q&A form)
    if (line.length > 20) {
      chunks.push({
        type: "prose",
        section: currentSection,
        question: null,
        content: line,
      });
    }
  }

  const embeddings = embeddingsConfigured() ? await embedTexts(chunks.map(chunkText)) : [];

  await sequelize.transaction(async (t) => {
    await KBChunk.destroy({ where: { sourceDoc: sourceDocLabel }, transaction: t });
    await KBChunk.bulkCreate(
      chunks.map((c, index) => ({ ...c, sourceDoc: sourceDocLabel, embedding: embeddings[index] || null })),
      { transaction: t }
    );
  });

  console.log(`[ingestDocx] ${sourceDocLabel}: ${chunks.length} chunks (${chunks.filter((c) => c.type === "qa").length} Q&A, ${chunks.filter((c) => c.type === "prose").length} prose, ${embeddings.length} embedded)`);
  return chunks.length;
}

// Run directly: `node src/services/ingestDocx.js path/to/file.docx [label]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2];
  const label = process.argv[3] || filePath.split("/").pop();
  if (!filePath) {
    console.error("Usage: node ingestDocx.js <path.docx> [label]");
    process.exit(1);
  }
  sequelize.sync().then(async () => {
    await fs.access(filePath); // throws if missing
    await ingestDocx(filePath, label);
    process.exit(0);
  });
}
