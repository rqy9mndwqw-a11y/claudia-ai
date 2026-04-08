-- Phase 1: Agent collaboration — static pairings for handoff suggestions

ALTER TABLE agents ADD COLUMN related_agents TEXT NOT NULL DEFAULT '[]';

-- DeFi cluster
UPDATE agents SET related_agents = '["claudia-yield-scout","claudia-gas-guru"]' WHERE id = 'claudia-defi-101';
UPDATE agents SET related_agents = '["claudia-defi-101","claudia-gas-guru"]' WHERE id = 'claudia-yield-scout';
UPDATE agents SET related_agents = '["claudia-defi-101","claudia-yield-scout"]' WHERE id = 'claudia-gas-guru';

-- Trading cluster
UPDATE agents SET related_agents = '["claudia-risk-check","claudia-token-analyst"]' WHERE id = 'claudia-chart-reader';
UPDATE agents SET related_agents = '["claudia-chart-reader","claudia-token-analyst"]' WHERE id = 'claudia-risk-check';

-- Research cluster
UPDATE agents SET related_agents = '["claudia-chart-reader","claudia-onchain-sleuth"]' WHERE id = 'claudia-token-analyst';
UPDATE agents SET related_agents = '["claudia-token-analyst","claudia-security-check"]' WHERE id = 'claudia-onchain-sleuth';

-- Degen cluster
UPDATE agents SET related_agents = '["claudia-security-check","claudia-airdrop-hunter"]' WHERE id = 'claudia-memecoin-radar';
UPDATE agents SET related_agents = '["claudia-memecoin-radar","claudia-security-check"]' WHERE id = 'claudia-airdrop-hunter';

-- General cluster
UPDATE agents SET related_agents = '["claudia-defi-101","claudia-security-check"]' WHERE id = 'claudia-base-guide';
UPDATE agents SET related_agents = '["claudia-base-guide","claudia-onchain-sleuth"]' WHERE id = 'claudia-security-check';
