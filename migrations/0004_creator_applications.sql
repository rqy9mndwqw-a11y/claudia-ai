-- Creator application signups (coming soon waitlist)
CREATE TABLE IF NOT EXISTS creator_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  contact TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(address)
);
