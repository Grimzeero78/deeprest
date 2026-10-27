-- ============================================================
-- DeepRest — Cloudflare D1 Database Schema (production)
-- ============================================================
-- Deploy with:
--   wrangler d1 execute deeprest-db --file=./cloudflare/schema.sql --remote
-- All timestamps are stored as ISO-8601 TEXT (D1/SQLite friendly).
-- Sensitive columns (chat content) hold AES-256-GCM ciphertext
-- produced in the Worker (WebCrypto), never plaintext.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- Users & auth (no email — name + password + hint only) ----------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,                       -- nanoid/uuid generated in Worker
  username      TEXT NOT NULL UNIQUE,                   -- lowercased name, login identifier
  name          TEXT NOT NULL,                          -- display name exactly as entered
  password_hash TEXT NOT NULL,                          -- scrypt (or PBKDF2) "salt:hash"
  password_hint TEXT,                                   -- optional hint returned on failed sign-in
  avatar_color  TEXT NOT NULL DEFAULT '#8b5cf6',
  avatar_image  TEXT,                                   -- WhatsApp-style profile photo (small data URL)
  avatar_emoji  TEXT,                                   -- optional emoji avatar
  bio           TEXT,                                   -- WhatsApp-style "About" status
  total_points  INTEGER NOT NULL DEFAULT 0,             -- XP driving the 10-rank ladder
  streak        INTEGER NOT NULL DEFAULT 0,             -- consecutive days meeting target
  last_eval_date TEXT,                                  -- last date scored by Cron (YYYY-MM-DD)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_settings (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  daily_target_min INTEGER NOT NULL DEFAULT 360,        -- the "6-Hour Target"
  timezone         TEXT NOT NULL DEFAULT 'UTC',
  notifications    INTEGER NOT NULL DEFAULT 1
);

-- ---------- Screen time monitoring (written by Cron Worker) ----------
CREATE TABLE IF NOT EXISTS screen_time_logs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,                          -- YYYY-MM-DD partition key
  minutes_used  INTEGER NOT NULL DEFAULT 0,
  target_min    INTEGER NOT NULL DEFAULT 360,
  points_earned INTEGER NOT NULL DEFAULT 0,             -- XP delta applied for this day
  met_target    INTEGER NOT NULL DEFAULT 0,             -- boolean
  evaluated     INTEGER NOT NULL DEFAULT 0,             -- cron has scored this day
  top_apps      TEXT NOT NULL DEFAULT '[]',             -- JSON [{name, minutes, category}]
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_stl_user_date ON screen_time_logs(user_id, date);

-- ---------- AI companion chats (persona: SHEPHERD | GUIDE | COUNSELOR) ----------
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona    TEXT NOT NULL CHECK (persona IN ('SHEPHERD','GUIDE','COUNSELOR')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, persona)
);
CREATE INDEX IF NOT EXISTS idx_cs_user_persona ON chat_sessions(user_id, persona);

-- content = "iv:tag:ciphertext" (AES-256-GCM, encrypted at rest)
CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cm_session ON chat_messages(session_id, created_at);

-- ---------- Dynamic Duo ----------
CREATE TABLE IF NOT EXISTS duo_partnerships (
  id          TEXT PRIMARY KEY,
  initiator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id  TEXT REFERENCES users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,                     -- e.g. "DR-4F7A2C"
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_duo_initiator ON duo_partnerships(initiator_id);
CREATE INDEX IF NOT EXISTS idx_duo_partner   ON duo_partnerships(partner_id);

-- ---------- SOS alerts ----------
CREATE TABLE IF NOT EXISTS sos_alerts (
  id         TEXT PRIMARY KEY,
  sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'push',               -- push | sms | email
  status     TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT','ACKNOWLEDGED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sos_sender ON sos_alerts(sender_id, created_at);

-- ---------- Calls (WebRTC / Cloudflare Calls signaling state) ----------
CREATE TABLE IF NOT EXISTS call_sessions (
  id          TEXT PRIMARY KEY,
  caller_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  modality    TEXT NOT NULL DEFAULT 'voice' CHECK (modality IN ('voice','video')),
  status      TEXT NOT NULL DEFAULT 'RINGING'
              CHECK (status IN ('RINGING','ACTIVE','ENDED','DECLINED','MISSED')),
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  answered_at TEXT,
  ended_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_call_caller ON call_sessions(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_callee ON call_sessions(callee_id, status);

-- ---------- Community: WhatsApp-style DMs & groups ----------
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL DEFAULT 'dm' CHECK (kind IN ('dm','group')),
  name       TEXT,                                       -- group name (NULL for DMs)
  emoji      TEXT,                                       -- group avatar emoji
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at);

CREATE TABLE IF NOT EXISTS conversation_members (
  id             TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at   TEXT,                                   -- unread tracking (ISO timestamp)
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

-- ---------- KV namespaces (wrangler.toml binding suggestions) ----------
-- KV "RATE_LIMIT"   : sliding-window counters for /ai + /sos (WAF offload)
-- KV "SESSION_REV"  : JWT session revocation list (jti -> revoked)
-- R2 "MEDIA"        : voice/video call recordings (opt-in) + avatars

-- ---------- Login throttling (cross-isolate, D1-backed) ----------
CREATE TABLE IF NOT EXISTS login_throttle (
  key          TEXT PRIMARY KEY,      -- e.g. "acct:isaac" or "ip:1.2.3.4"
  fails        INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now'))
);
