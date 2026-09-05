# Zithara AI Layer — Backend

Express API for the Tyaani / Zithara AI sales agent. It crawls a brand website into a business profile, indexes documents and pages into a knowledge base, reads live catalog and ads from `zithara_prod`, and answers chat on web, WhatsApp, Instagram, and Facebook.

Companion UI: [`ai_poc_fe`](https://github.com/dileep-zithara/ai_poc_fe).

## Requirements

- Node.js 20+
- npm
- Optional: PostgreSQL with pgvector for production (`DATABASE_URL`)
- Optional: read-only `zithara_prod` Postgres for live catalog and Meta ads

Without `DATABASE_URL` the API uses local SQLite (`ai-layer.sqlite`).

## Setup

```bash
cd ai_poc_be
npm install
# create a local .env from the table below — do not commit it
npm run dev
```

API listens on `http://localhost:4200` by default.

```bash
curl http://localhost:4200/health
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start with `--watch` |
| `npm start` | Production start |
| `npm run ingest-sample` | Ingest `src/data/sample-kb.docx` into the KB |

## Environment

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | Default `4200` |
| `DATABASE_URL` | prod | Postgres URL. Omit for local SQLite |
| `DATABASE_SSL` | no | Set `true` if Postgres needs SSL |
| `ZITHARA_PROD_DATABASE_URL` | catalog / ads | Read-only zithara_prod connection |
| `ZITHARA_PROD_SSL` | no | Set `true` if that DB needs SSL |
| `TYAANI_MERCHANT_ID` | no | Merchant filter for catalog and ads |
| `ANTHROPIC_API_KEY` | no | Fallback if no key is saved in Model Settings |
| `OPENAI_API_KEY` | no | Fallback LLM / embeddings key |
| `EMBEDDING_PROVIDER` | no | Optional embedding provider |
| `EMBEDDING_MODEL` | no | Default `text-embedding-3-small` |
| `EMBEDDING_API_KEY` | no | Defaults to `OPENAI_API_KEY` |

Never commit `.env`. API keys can also be stored from the frontend Model Settings tab.

## Main routes

All JSON routes are under `/api`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Process + catalog ping |
| `GET` / `PUT` | `/api/business-profile` | Brand, stores, policies |
| `POST` | `/api/business-profile/import-from-website` | Start website import (returns `202`, poll `GET` profile) |
| `GET` / `POST` | `/api/web-sources` | Crawl and index site pages |
| `POST` | `/api/documents/upload` | Ingest a `.docx` into the KB |
| `POST` | `/api/chat` | Agent reply (text, attachment, or webhook JSON) |
| `POST` | `/api/chat/reset` | Clear a session |
| `GET` | `/api/catalog/ads` | Live Meta ads from zithara_prod |
| `GET` | `/api/catalog/adsets` | Live ad sets |
| `POST` | `/api/ad-catalog/sync-from-prod` | Copy live ads into the local catalog |
| `POST` | `/api/ad-catalog/import` | Upload a Meta ads JSON export |
| `POST` | `/api/ad-context` | Map an ad to a product |
| `GET` / `PUT` | `/api/model-config` | Active model and provider keys |
| `GET` / `PUT` | `/api/agent-settings` | Replies, handoff, catalog search |

Website import and web-source fetch run in the background so they stay under typical 60s gateway timeouts. Poll `GET /api/business-profile` (`importJob.status`) or `GET /api/web-sources`.

If Nginx or another proxy sits in front, do not also set `Access-Control-Allow-Origin` there. CORS is already enabled in Express; a duplicate header will fail the browser.

## How chat is grounded

1. **Business profile** — brand name, stores, hours, WhatsApp, policies (from website import or edits)
2. **Product catalog** — live prices and stock from `zithara_prod` when configured
3. **KB** — uploaded docs and crawled page text
4. **Ad context** — mapped ad → product, plus live creative when available

Stores used in replies come from the business profile, not a hardcoded city list.

## Deploy notes

1. Pull this repo on the server (`/opt/zithara-ai-layer/ai_poc_be` or similar)
2. `npm install --omit=dev`
3. Set env vars on the process, not only in a local `.env` if you use systemd/pm2
4. Restart Node after every pull — it does not hot-reload in production
