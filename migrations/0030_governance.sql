CREATE TABLE governance_proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  proposed_by TEXT NOT NULL,
  proposer_token_id INTEGER,
  status TEXT DEFAULT 'active',
  yes_votes INTEGER DEFAULT 0,
  no_votes INTEGER DEFAULT 0,
  total_weight INTEGER DEFAULT 0,
  voting_ends_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE governance_votes (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES governance_proposals(id),
  voter_address TEXT NOT NULL,
  voter_token_id INTEGER NOT NULL,
  vote TEXT NOT NULL,
  vote_weight INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_governance_proposals_status ON governance_proposals(status);
CREATE INDEX idx_governance_votes_proposal ON governance_votes(proposal_id);
