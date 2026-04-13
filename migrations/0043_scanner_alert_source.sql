-- Tag each scanner alert with its origin source so the UI can render badges
-- like "📈 Top gainer 4h" or "🚨 Flashblocks launch" on signal cards.
--
-- Values (no CHECK — keeps writes forgiving):
--   'top50'           CoinGecko top-50 by market cap
--   'base_trending'   DexScreener Base top volume
--   'gainer_1h'       Top 1h price gainers on Base
--   'gainer_4h'       Top 4h price gainers on Base
--   'gainer_24h'      Top 24h gainers (CoinGecko)
--   'watchlist'       User-watchlisted token
--   'launch'          Recently-detected Flashblocks launch
--   NULL              legacy rows (pre-universe-builder)

ALTER TABLE scanner_alerts ADD COLUMN alert_source TEXT;

CREATE INDEX IF NOT EXISTS idx_scanner_alerts_source
  ON scanner_alerts(alert_source, alerted_at DESC);
