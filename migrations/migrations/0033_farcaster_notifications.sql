CREATE TABLE IF NOT EXISTS farcaster_notifications (
  fid INTEGER PRIMARY KEY,
  token TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
