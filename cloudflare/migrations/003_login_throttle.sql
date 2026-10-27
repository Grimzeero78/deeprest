-- 003: cross-isolate login throttling.
-- In-memory Maps live per Workers isolate, so a scripted attacker hitting
-- N isolates gets N limits. This table is shared state in D1.
CREATE TABLE IF NOT EXISTS login_throttle (
  key          TEXT PRIMARY KEY,      -- e.g. "acct:isaac" or "ip:1.2.3.4"
  fails        INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now'))
);
