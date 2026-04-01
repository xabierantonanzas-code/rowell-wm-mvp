-- Performance indices for heavy queries
-- These cover the most common query patterns in the dashboard

-- Positions: snapshot aggregation (used by getAllPositionHistory)
CREATE INDEX IF NOT EXISTS idx_positions_snapshot_value
  ON positions (snapshot_date, position_value);

-- Positions: account + date lookups (used by getLatestPositions, getPositionHistory)
CREATE INDEX IF NOT EXISTS idx_positions_account_snapshot
  ON positions (account_id, snapshot_date DESC);

-- Positions: date-only lookups for admin "all clients" view
CREATE INDEX IF NOT EXISTS idx_positions_snapshot_date
  ON positions (snapshot_date DESC);

-- Operations: account + date (used by getOperations)
CREATE INDEX IF NOT EXISTS idx_operations_account_date
  ON operations (account_id, operation_date DESC);

-- Cash balances: account + date
CREATE INDEX IF NOT EXISTS idx_cash_balances_account_date
  ON cash_balances (account_id, snapshot_date DESC);

-- Clients: auth user lookup (used after invite confirmation)
CREATE INDEX IF NOT EXISTS idx_clients_auth_user
  ON clients (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Invitations: email + status lookup
CREATE INDEX IF NOT EXISTS idx_invitations_email_status
  ON invitations (email, status);
