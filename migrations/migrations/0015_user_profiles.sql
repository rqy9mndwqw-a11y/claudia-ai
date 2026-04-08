CREATE TABLE IF NOT EXISTS user_profiles (
  address TEXT PRIMARY KEY,
  display_name TEXT,
  tagline TEXT,
  x_handle TEXT,
  avatar_preset TEXT NOT NULL DEFAULT 'default',
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_name
  ON user_profiles(display_name);
