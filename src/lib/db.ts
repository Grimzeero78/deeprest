import { PrismaClient } from "@/generated/prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";

// ============================================================
// DeepRest DB client — dual-mode by runtime:
//   • Cloudflare Workers (OpenNext): PrismaD1 adapter bound to
//     the "DB" D1 binding from wrangler.jsonc — the SAME code
//     and schema run against D1 in production.
//   • Local sandbox / `next dev`: better-sqlite3 adapter on the
//     file database from DATABASE_URL.
// Both paths use the pure-TS queryCompiler engine (no Rust
// binaries), which is what makes Workers deployment possible.
// Resolved lazily per request via a Proxy so route files stay
// unchanged (`import { db } from "@/lib/db"`).
// ============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  // 1) Cloudflare Workers / wrangler dev / opennextjs-cloudflare preview
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: () => { env?: { DB?: unknown } } | undefined;
    };
    const env = getCloudflareContext()?.env;
    if (env?.DB) {
      return new PrismaClient({ adapter: new PrismaD1(env.DB as never) });
    }
  } catch {
    // not running inside a Cloudflare context — fall through to SQLite
  }

  // 2) Local development: file-based SQLite via DATABASE_URL
  const url = process.env.DATABASE_URL || "file:./db/custom.db";
  return new PrismaClient({
    adapter: new PrismaBetterSQLite3({ url: url.replace(/^file:/, "") }),
    log: process.env.NODE_ENV === "production" ? [] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

/**
 * Lazy Prisma proxy — the underlying client (SQLite vs D1) is
 * chosen on first property access, which always happens inside a
 * request where the Cloudflare context (if any) is available.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
