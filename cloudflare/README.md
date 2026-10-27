# DeepRest — Cloudflare Production Deployment Guide

The runnable demo in this repo uses **Next.js 16 + Prisma/SQLite** (sandbox constraint).
Every feature maps 1:1 to your target stack. This folder holds the production artifacts.

## Stack mapping (demo → production)

| Concern | Demo (this repo) | Production (Cloudflare) |
|---|---|---|
| API layer | Next.js API routes (`src/app/api/**`) | Worker routes / Hono on Workers |
| Database | Prisma + SQLite (`prisma/schema.prisma`) | **D1** — `cloudflare/schema.sql` |
| Monitoring service | `/api/cron/evaluate` polled by dashboard | **Worker Cron Trigger** — `cloudflare/worker-cron.js` |
| Rate limiting | In-memory sliding window (`src/lib/rate-limit.ts`) | **WAF rate-limiting rules** + KV counters |
| Auth | JWT (jose) + scrypt, httpOnly cookie | Same JWT pattern, or **Cloudflare Access / Lucia** with KV session revocation |
| Chat encryption at rest | AES-256-GCM (`src/lib/crypto.ts`) | WebCrypto AES-256-GCM in the Worker (same `iv:tag:ciphertext` format) |
| Voice/video | Simulated WebRTC via `/api/call` state machine | **Cloudflare Calls** (or bare WebRTC with TURN) |
| Media storage | — | **R2** bucket `MEDIA` (call recordings, avatars) |
| Notifications (SOS) | Simulated channels | Twilio (SMS) + Resend (email) + Web Push via **Queues** |

## Deploy steps

1. **Create resources**
   ```bash
   wrangler d1 create deeprest-db        # copy the database_id into wrangler.toml
   wrangler kv namespace create RATE_LIMIT
   wrangler r2 bucket create deeprest-media
   ```

2. **Point `wrangler.toml` at your database** — `cloudflare/wrangler.toml` already
   contains the D1 binding (`database_id = 28688ccf-…`); update `database_name`
   if you named yours differently, and paste the KV namespace ids when created.

3. **Apply the schema** (creates all tables inside your D1 database)
   ```bash
   wrangler d1 execute deeprest-db --remote --file=./cloudflare/schema.sql
   ```

4. **Deploy the cron worker**
   ```bash
   cd cloudflare && wrangler deploy        # uses wrangler.toml (name, crons, DB binding)
   ```
   - Secrets: `wrangler secret put JWT_SECRET`, `wrangler secret put ENCRYPTION_KEY`,
     `wrangler secret put CRON_SECRET`

5. **WAF rules (dashboard → Security → WAF)**
   - `/api/chat/*`  : rate limit 20 req/min per IP+JWT → managed challenge
   - `/api/sos`     : rate limit 3 req/5min per IP+JWT → block
   - `/api/auth/*`  : rate limit 10 req/min per IP → managed challenge
   - Global: bot fight mode + AI bots blocked.

6. **Secrets** (via `wrangler secret put` or Worker → Settings → Variables)
   - `JWT_SECRET`, `ENCRYPTION_KEY` (32+ random chars each), `CRON_SECRET`,
     `TWILIO_AUTH_TOKEN`, `RESEND_API_KEY`.

## Rank System (source of truth)

Scoring engine lives in `src/lib/ranks.ts` (demo) and `cloudflare/worker-cron.js` (prod):

- **Under target**: `+50 XP` base, `+5 XP × streak days` (capped at `+35`)
- **Over target**: `−25 XP` (floor 0), streak resets
- 10 ranks from `Restless` (0 XP) → `DeepRest Master` (6,000 XP)

Rank icons are inline SVGs (`src/components/deeprest/RankIcons.tsx`) — export to PNG at
any size by rasterizing the SVG nodes (e.g. `sharp` in a build script) if needed for app stores.
