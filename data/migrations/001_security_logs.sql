-- Security logs table
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip TEXT,
  email TEXT,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying recent events
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at
  ON security_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_logs_ip
  ON security_logs (ip, created_at DESC);

-- RLS: only service_role can insert, only admins can read
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert security logs"
  ON security_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can read security logs"
  ON security_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'role') IN ('admin', 'owner')
    )
  );
