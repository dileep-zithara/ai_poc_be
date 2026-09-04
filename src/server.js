import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { databaseCapabilities, sequelize } from "./models/index.js";
import "./models/KBChunk.js";
import "./models/AdContext.js";
import "./models/Conversation.js";
import "./models/ModelConfig.js";
import "./models/ProviderCredential.js";
import "./models/WebSource.js";
import "./models/BusinessProfile.js";
import "./models/AgentSettings.js";
import "./models/AdCatalogEntry.js";
import { buildKBIndex, kbIndexReady } from "./services/kbIndex.js";
import documentsRouter from "./routes/documents.js";
import adContextRouter from "./routes/adContext.js";
import chatRouter from "./routes/chat.js";
import modelConfigRouter from "./routes/modelConfig.js";
import webSourcesRouter, { resumePendingWebSources } from "./routes/webSources.js";
import businessProfileRouter from "./routes/businessProfile.js";
import agentSettingsRouter from "./routes/agentSettings.js";
import adCatalogRouter from "./routes/adCatalog.js";
import { migrateDatabase } from "./services/databaseMigration.js";
import catalogRouter from "./routes/catalog.js";
import { pingZitharaProd, zitharaProdConfigured } from "./services/zitharaProd.js";

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || "https://zagent.zithara.live,http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin) || corsOrigins.includes("*")) return callback(null, true);
    try {
      if (/(^|\.)zithara\.live$/.test(new URL(origin).hostname)) return callback(null, true);
    } catch { /* ignore */ }
    return callback(null, true);
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (_req, res) => {
  const prod = zitharaProdConfigured() ? await pingZitharaProd() : { configured: false, ok: false };
  res.json({ status: "ok", kbReady: kbIndexReady(), zitharaProd: prod });
});
app.use("/api/documents", documentsRouter);
app.use("/api/ad-context", adContextRouter);
app.use("/api/chat", chatRouter);
app.use("/api/model-config", modelConfigRouter);
app.use("/api/web-sources", webSourcesRouter);
app.use("/api/business-profile", businessProfileRouter);
app.use("/api/agent-settings", agentSettingsRouter);
app.use("/api/ad-catalog", adCatalogRouter);
app.use("/api/catalog", catalogRouter);


async function start() {
  // pgvector owns KBChunks.embedding on Postgres; Sequelize's JSON model
  // declaration must not alter that native vector column. SQLite still
  // uses alter mode for frictionless local development.
  await sequelize.sync(databaseCapabilities.isPostgres ? {} : { alter: true });
  await migrateDatabase();
  await buildKBIndex(); // picks up whatever's already ingested
  app.listen(config.port, () => {
    console.log(`ai-layer backend listening on :${config.port}`);
    resumePendingWebSources().catch((err) => console.error("[webSources] resume failed:", err.message));
  });
  if (zitharaProdConfigured()) {
    pingZitharaProd().then((prod) => {
      if (prod.ok) console.log(`[zitharaProd] connected — ${prod.productCount} Tyaani catalog products`);
      else console.error(`[zitharaProd] configured but not reachable: ${prod.error}`);
    });
  } else {
    console.log("[zitharaProd] not configured — set ZITHARA_PROD_DATABASE_URL to read Tyaani catalog");
  }
}

start();
