-- ============================================================
-- DeepRest migration 002 — Community (DMs & groups) + profiles
-- Apply to the LIVE remote database:
--   wrangler d1 execute deeprest-db --remote --file=./cloudflare/migrations/002_social.sql
-- Idempotent-ish: run once; ALTER TABLE fails if column exists (safe to skip then).
-- ============================================================

ALTER TABLE users ADD COLUMN avatar_image TEXT;
ALTER TABLE users ADD COLUMN avatar_emoji TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL DEFAULT 'dm' CHECK (kind IN ('dm','group')),
  name       TEXT,
  emoji      TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at);

CREATE TABLE IF NOT EXISTS conversation_members (
  id             TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at   TEXT,
  joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cmember_user ON conversation_members(user_id);

CREATE TABLE IF NOT EXISTS direct_messages (
  id             TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body           TEXT NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','system')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dm_convo ON direct_messages(conversation_id, created_at);
