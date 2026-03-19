-- ============================================================
-- ROWELL PATRIMONIOS — FIX: Eliminar policies existentes y recrear
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Eliminar policies existentes
DROP POLICY IF EXISTS "Admin full access on clients" ON public.clients;
DROP POLICY IF EXISTS "Client can view own record" ON public.clients;
DROP POLICY IF EXISTS "Admin full access on accounts" ON public.accounts;
DROP POLICY IF EXISTS "Client can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admin full access on positions" ON public.positions;
DROP POLICY IF EXISTS "Client can view own positions" ON public.positions;
DROP POLICY IF EXISTS "Admin full access on cash_balances" ON public.cash_balances;
DROP POLICY IF EXISTS "Client can view own balances" ON public.cash_balances;
DROP POLICY IF EXISTS "Admin full access on operations" ON public.operations;
DROP POLICY IF EXISTS "Client can view own operations" ON public.operations;
DROP POLICY IF EXISTS "Admin full access on uploads" ON public.uploads;

-- Eliminar trigger existente
DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;

-- ============================================================
-- Recrear RLS policies
-- ============================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- CLIENTS
CREATE POLICY "Admin full access on clients"
  ON public.clients FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Client can view own record"
  ON public.clients FOR SELECT
  USING (email = auth.jwt() ->> 'email');

-- ACCOUNTS
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

-- POSITIONS
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

-- CASH BALANCES
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

-- OPERATIONS
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

-- UPLOADS
CREATE POLICY "Admin full access on uploads"
  ON public.uploads FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- Recrear trigger updated_at
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
-- FIN
-- ============================================================
