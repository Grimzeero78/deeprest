# DeepRest — Cloudflare Deployment Guide

The app is a **Next.js 16** application deployed to **Cloudflare Workers** via
[OpenNext](https://opennext.js.org/cloudflare) — Cloudflare's official adapter
for Next.js on Workers.

> ⚠️ **Why your Pages URL 404'd**: Cloudflare **Pages** cannot run Next.js 16
> (its `@cloudflare/next-on-pages` adapter stopped at Next 13/14). A Git-connected
> Pages project builds with no output → 404. The app now targets **Workers**,
> which fully supports Next.js 16 and your D1 database. You can delete the old
> Pages project after the Worker is live.

## Architecture (one codebase, two runtimes)

| Layer | Runtime | Database driver |
|---|---|---|
| Local dev (`bun dev`) | Node.js | `@prisma/adapter-better-sqlite3` (file DB) |
| Cloudflare Workers | workerd | `@prisma/adapter-d1` (your D1 binding) |

- **Auth**: PBKDF2-SHA256 via WebCrypto (no node:crypto — Workers-safe)
- **Chat encryption**: AES-256-GCM via WebCrypto, `iv:tag:ciphertext` at rest
- **AI companions**: Workers AI binding (`env.AI`) → OpenAI-compatible fallback → graceful offline replies
- **Schema**: `prisma/schema.prisma` is mapped 1:1 onto `cloudflare/schema.sql`
  (snake_case tables) — the same client runs against both databases

## Deploy steps

### Option A — Git-connected (recommended)

1. Cloudflare dashboard → **Workers & Pages → Create → Workers → Import a repository**
2. Select `Grimzeero78/deeprest`, then set:
   - **Framework preset**: `Next.js` (uses OpenNext)
   - **Build command**: `npx opennextjs-cloudflare build`
   - **Deploy command**: `npx wrangler deploy`
3. Bindings come from the committed `wrangler.jsonc` automatically:
   - D1 `DB` → database `e4caa5a2-74a7-441d-b6f5-fb95e32ca24e`
   - Workers AI `AI`
4. Add secrets (dashboard → your Worker → Settings → Variables and Secrets, or CLI):
   ```bash
   bunx wrangler secret put JWT_SECRET       # 32+ random chars
   bunx wrangler secret put ENCRYPTION_KEY   # 32+ random chars
   ```
5. Create the tables in your **remote** D1 database (one time):
   ```bash
   bunx wrangler d1 execute deeprest-db --remote --file=./cloudflare/schema.sql
   ```

### Option B — CLI

```bash
bunx wrangler login
bun run build:cf                 # prisma generate + opennextjs-cloudflare build
bun run deploy:cf                # wrangler deploy (uses wrangler.jsonc bindings)
bunx wrangler d1 execute deeprest-db --remote --file=./cloudflare/schema.sql
bunx wrangler secret put JWT_SECRET
bunx wrangler secret put ENCRYPTION_KEY
```

## Cron worker (daily XP scoring)

Separate worker, deploy from its folder (own `wrangler.toml`, same D1):

```bash
cd cloudflare && wrangler deploy
```

## WAF rules (dashboard → Security → WAF)

- `/api/chat/*`  : rate limit 20 req/min per IP+JWT → managed challenge
- `/api/sos`     : rate limit 3 req/5min per IP+JWT → block
- `/api/auth/*`  : rate limit 10 req/min per IP → managed challenge
- Global: bot fight mode + AI bots blocked.

## Local preview of the Workers build

```bash
bunx wrangler d1 execute deeprest-db --local --file=./cloudflare/schema.sql
bunx wrangler dev -c wrangler.local.jsonc --port 8787   # local config omits the AI binding
```

## Secrets / env vars reference

| Name | Where | Purpose |
|---|---|---|
| `JWT_SECRET` | Worker secret | Signs session JWTs |
| `ENCRYPTION_KEY` | Worker secret | Derives AES-256-GCM key (chat at rest) |
| `AI_MODEL` | `wrangler.jsonc` vars | Workers AI model id |
| `OPENAI_API_KEY` | Worker secret (optional) | OpenAI-compatible provider instead of Workers AI |
| `CRON_SECRET` | cron worker var/secret | Protects the debug HTTP endpoint |

## Rank System (source of truth)

Scoring engine lives in `src/lib/ranks.ts` (shared) and `cloudflare/worker-cron.js` (prod):

- **Under target**: `+50 XP` base, `+5 XP × streak days` (capped at `+35`)
- **Over target**: `−25 XP` (floor 0), streak resets
- 10 ranks from `Restless` (0 XP) → `DeepRest Master` (6,000 XP)

Rank icons are inline SVGs (`src/components/deeprest/RankIcons.tsx`).
