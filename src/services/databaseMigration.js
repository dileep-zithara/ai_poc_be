import { sequelize, databaseCapabilities } from "../models/index.js";

/** Enables pgvector and upgrades the embedding column when running on Postgres. */
export async function migrateDatabase() {
  if (!databaseCapabilities.isPostgres) return;

  await sequelize.query("CREATE EXTENSION IF NOT EXISTS vector");
  // Sequelize sync must not alter pgvector columns, so production schema
  // additions are applied explicitly and safely here. Both statements are
  // idempotent and preserve existing rows.
  await sequelize.query('ALTER TABLE "AdCatalogEntries" ADD COLUMN IF NOT EXISTS "rawData" JSONB');
  await sequelize.query('ALTER TABLE "BusinessProfiles" ALTER COLUMN "location" TYPE TEXT');
  await sequelize.query('ALTER TABLE "BusinessProfiles" ALTER COLUMN "contactInfo" TYPE TEXT');
  await sequelize.query('ALTER TABLE "BusinessProfiles" ALTER COLUMN "socialLinks" TYPE TEXT');
  await sequelize.query('ALTER TABLE "BusinessProfiles" ALTER COLUMN "supportHours" TYPE TEXT');
  await sequelize.query('ALTER TABLE "BusinessProfiles" ADD COLUMN IF NOT EXISTS "importJob" TEXT NOT NULL DEFAULT \'{"status":"idle"}\'');
  await sequelize.query('ALTER TABLE "Conversations" ADD COLUMN IF NOT EXISTS "channel" VARCHAR(255) NOT NULL DEFAULT \'web\'');
  await sequelize.query('ALTER TABLE "Conversations" ADD COLUMN IF NOT EXISTS "sessionContext" TEXT NOT NULL DEFAULT \'{}\'');
  await sequelize.query('ALTER TABLE "AgentSettings" ADD COLUMN IF NOT EXISTS "nudgeDelayMinutes" INTEGER NOT NULL DEFAULT 60');
  await sequelize.query('ALTER TABLE "AgentSettings" ADD COLUMN IF NOT EXISTS "nudgeMessage" TEXT NOT NULL DEFAULT \'Hi, is there anything else I can help you with?\'');
  await sequelize.query(`
    ALTER TABLE "KBChunks"
    ALTER COLUMN "embedding" TYPE vector(1536)
    USING CASE
      WHEN "embedding" IS NULL THEN NULL
      ELSE "embedding"::text::vector
    END
  `).catch((error) => {
    // New installations create the JSON column through Sequelize first; it is
    // converted here. Existing vector installations are already up to date.
    if (!/vector\(1536\)|cannot cast/i.test(error.message)) throw error;
  });
  await sequelize.query('CREATE INDEX IF NOT EXISTS "kb_chunks_embedding_idx" ON "KBChunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100)');
}
