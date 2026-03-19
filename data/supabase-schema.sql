-- ============================================================
-- ROWELL PATRIMONIOS — Schema SQL para Supabase
-- Ejecutar en el SQL Editor de Supabase (completo, de una vez)
-- ============================================================

-- 0. Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Helper: funcion is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ============================================================
-- 2. Tablas
-- ============================================================

-- 2a. Clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT NOT NULL,
  email       TEXT UNIQUE,
  phone       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2b. Cuentas (una cuenta = una cartera de valores en Mapfre)
CREATE TABLE IF NOT EXISTS public.accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  account_number  TEXT NOT NULL UNIQUE,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2c. Posiciones (snapshot periodico)
CREATE TABLE IF NOT EXISTS public.positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  isin            TEXT,
  product_name    TEXT,
  manager         TEXT,
  currency        TEXT DEFAULT 'EUR',
  units           NUMERIC(18,6),
  avg_cost        NUMERIC(18,6),
  market_price    NUMERIC(18,6),
  position_value  NUMERIC(18,2),
  fx_rate         NUMERIC(18,6),
  purchase_date   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, snapshot_date, isin)
);

-- 2d. Saldos de cuenta de efectivo
CREATE TABLE IF NOT EXISTS public.cash_balances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  snapshot_date       DATE NOT NULL,
  cash_account_number TEXT,
  currency            TEXT DEFAULT 'EUR',
  balance             NUMERIC(18,2),
  sign                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, snapshot_date, cash_account_number)
);

-- 2e. Operaciones
CREATE TABLE IF NOT EXISTS public.operations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  operation_number  TEXT UNIQUE,
  operation_type    TEXT,
  isin              TEXT,
  product_name      TEXT,
  operation_date    DATE,
  settlement_date   DATE,
  currency          TEXT DEFAULT 'EUR',
  units             NUMERIC(18,6),
  gross_amount      NUMERIC(18,2),
  net_amount        NUMERIC(18,2),
  fx_rate           NUMERIC(18,6),
  eur_amount        NUMERIC(18,2),
  withholding       NUMERIC(18,2),
  commission        NUMERIC(18,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2f. Registro de subidas
CREATE TABLE IF NOT EXISTS public.uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by     UUID NOT NULL,
  file_names      TEXT[] NOT NULL DEFAULT '{}',
  rows_inserted   INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'success',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Indices para rendimiento
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_positions_account_date
  ON public.positions(account_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_positions_snapshot_date
  ON public.positions(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_operations_account_date
  ON public.operations(account_id, operation_date DESC);

CREATE INDEX IF NOT EXISTS idx_operations_number
  ON public.operations(operation_number);

CREATE INDEX IF NOT EXISTS idx_cash_balances_account_date
  ON public.cash_balances(account_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_client
  ON public.accounts(client_id);

CREATE INDEX IF NOT EXISTS idx_accounts_number
  ON public.accounts(account_number);

-- ============================================================
-- 4. Row Level Security (RLS)
-- ============================================================

-- Activar RLS en todas las tablas
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- ---- CLIENTS ----
CREATE POLICY "Admin full access on clients"
  ON public.clients FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Client can view own record"
  ON public.clients FOR SELECT
  USING (email = auth.jwt() ->> 'email');

-- ---- ACCOUNTS ----
CREATE POLICY "Admin full access on accounts"
  ON public.accounts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Client can view own accounts"
  ON public.accounts FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- ---- POSITIONS ----
CREATE POLICY "Admin full access on positions"
  ON public.positions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Client can view own positions"
  ON public.positions FOR SELECT
  USING (
    account_id IN (
      SELECT a.id FROM public.accounts a
      JOIN public.clients c ON c.id = a.client_id
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- ---- CASH BALANCES ----
CREATE POLICY "Admin full access on cash_balances"
  ON public.cash_balances FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Client can view own balances"
  ON public.cash_balances FOR SELECT
  USING (
    account_id IN (
      SELECT a.id FROM public.accounts a
      JOIN public.clients c ON c.id = a.client_id
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- ---- OPERATIONS ----
CREATE POLICY "Admin full access on operations"
  ON public.operations FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Client can view own operations"
  ON public.operations FOR SELECT
  USING (
    account_id IN (
      SELECT a.id FROM public.accounts a
      JOIN public.clients c ON c.id = a.client_id
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- ---- UPLOADS ----
CREATE POLICY "Admin full access on uploads"
  ON public.uploads FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 5. Trigger para updated_at en clients
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- FIN DEL SCHEMA
-- ============================================================
