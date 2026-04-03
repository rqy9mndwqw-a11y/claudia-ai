-- Pre-aggregated daily accuracy stats for the accuracy dashboard.

CREATE TABLE IF NOT EXISTS verdict_accuracy_daily (
  date TEXT NOT NULL,
  verdict_type TEXT NOT NULL,

  total_predictions INTEGER DEFAULT 0,
  correct INTEGER DEFAULT 0,
  incorrect INTEGER DEFAULT 0,
  neutral INTEGER DEFAULT 0,

  avg_score REAL,
  avg_points REAL,
  avg_change_7d REAL,

  best_call_symbol TEXT,
  best_call_points INTEGER,
  worst_call_symbol TEXT,
  worst_call_points INTEGER,

  market_regime TEXT,

  PRIMARY KEY (date, verdict_type)
);
