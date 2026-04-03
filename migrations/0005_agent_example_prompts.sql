-- Add example_prompts JSON field to agents table
ALTER TABLE agents ADD COLUMN example_prompts TEXT NOT NULL DEFAULT '[]';

-- Seed example prompts for default CLAUDIA agents
UPDATE agents SET example_prompts = '["What is impermanent loss and when does it actually matter?","Explain how Aave lending works in simple terms","What are the risks of liquid staking?","Compare yield farming vs staking"]' WHERE id = 'claudia-defi-101';
UPDATE agents SET example_prompts = '["Is 50% APY on a stablecoin pool sustainable?","Break down the yield on this Aerodrome USDC/WETH pool","What are the biggest yield farming risks right now?","How do I calculate real yield after fees?"]' WHERE id = 'claudia-yield-scout';
UPDATE agents SET example_prompts = '["What L2 should I use to save on gas?","How do I batch multiple transactions?","Compare gas costs: Base vs Arbitrum vs Optimism","When is the cheapest time to transact on Ethereum?"]' WHERE id = 'claudia-gas-guru';
UPDATE agents SET example_prompts = '["What does RSI divergence mean for price?","Explain MACD crossover signals","How do I identify support and resistance levels?","What does high volume on a red candle mean?"]' WHERE id = 'claudia-chart-reader';
UPDATE agents SET example_prompts = '["I want to buy $500 of ETH — how should I size this?","What stop loss percentage should I use for altcoins?","Am I overexposed if 60% of my portfolio is one token?","Calculate my risk/reward on this trade setup"]' WHERE id = 'claudia-risk-check';
UPDATE agents SET example_prompts = '["Analyze the tokenomics of $ARB","What are red flags in a token vesting schedule?","How do I evaluate team token allocations?","Is this token deflationary or inflationary?"]' WHERE id = 'claudia-token-analyst';
UPDATE agents SET example_prompts = '["How do I track whale wallets?","What does large exchange inflow mean?","Explain wash trading indicators","How do I use Dune Analytics for on-chain research?"]' WHERE id = 'claudia-onchain-sleuth';
UPDATE agents SET example_prompts = '["What memecoin narratives are trending right now?","How do I check if a token is a honeypot?","What should I look for in memecoin holder distribution?","Rate the rug risk on this new launch"]' WHERE id = 'claudia-memecoin-radar';
UPDATE agents SET example_prompts = '["What protocols are most likely to airdrop soon?","How do I farm airdrops cost-effectively?","What on-chain activity do protocols typically reward?","How do I avoid getting flagged as a Sybil?"]' WHERE id = 'claudia-airdrop-hunter';
UPDATE agents SET example_prompts = '["What are the top protocols on Base right now?","How do I bridge to Base cheaply?","Compare Base vs Arbitrum for DeFi","What is the Aerodrome ecosystem?"]' WHERE id = 'claudia-base-guide';
UPDATE agents SET example_prompts = '["How do I revoke token approvals?","What is address poisoning and how do I avoid it?","Best practices for hardware wallet setup","How do I spot a phishing dApp?"]' WHERE id = 'claudia-security-check';
