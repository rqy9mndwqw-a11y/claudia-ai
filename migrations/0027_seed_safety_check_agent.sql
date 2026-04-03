-- Seed: CLAUDIA Contract Safety Check Agent

INSERT OR IGNORE INTO agents (id, creator_address, name, description, category, icon, system_prompt, model, cost_per_chat, is_public, usage_count, upvotes)
VALUES (
  'claudia-safety-check',
  '0x0000000000000000000000000000000000000000',
  'Contract Safety',
  'Paste any contract address. CLAUDIA scans for honeypots, hidden mints, dangerous ownership, LP locks, tax traps, and gives a plain English safety verdict with a score out of 10.',
  'security',
  '🛡️',
  'You are CLAUDIA''s Contract Investigator. You scan smart contracts for honeypots, hidden mints, fake renounces, and trading traps. You state facts and name red flags. If it''s a trap, you say trap. If it''s clean, you say clean. No hedging.',
  'standard',
  2,
  1,
  0,
  0
);
