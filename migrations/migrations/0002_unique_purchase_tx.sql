-- Add unique index on (reference_id, type) to prevent race condition
-- on duplicate tx hash submissions for credit purchases.
-- The SELECT-then-INSERT pattern is not atomic; this constraint
-- makes the INSERT fail if a duplicate exists, catching races.

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_unique_purchase
  ON credit_transactions(reference_id, type)
  WHERE type = 'purchase';
