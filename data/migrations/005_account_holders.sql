-- ============================================================
-- 005_account_holders: multi-titular y representantes legales
-- ============================================================
--
-- Edgard MVP6 punto 9: una cuenta de valores (CV) puede tener varios
-- titulares y representantes legales. El esquema actual usa
-- accounts.client_id (1:1) que solo permite un titular.
--
-- Solucion: tabla account_holders (account_id, client_id, role) que
-- modela la relacion many-to-many.
--
-- Mantenemos accounts.client_id como columna legacy (deprecada) para
-- no romper queries existentes mientras migramos. Backfill copiando
-- el valor actual a account_holders con role = 'titular'.

CREATE TABLE IF NOT EXISTS public.account_holders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'titular'
                CHECK (role IN ('titular', 'representante')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, client_id, role)
);

CREATE INDEX IF NOT EXISTS idx_account_holders_client
  ON public.account_holders (client_id);

CREATE INDEX IF NOT EXISTS idx_account_holders_account
  ON public.account_holders (account_id);

-- ============================================================
-- Backfill desde accounts.client_id (datos existentes)
-- ============================================================

INSERT INTO public.account_holders (account_id, client_id, role)
SELECT id, client_id, 'titular'
FROM public.accounts
WHERE client_id IS NOT NULL
ON CONFLICT (account_id, client_id, role) DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.account_holders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on account_holders" ON public.account_holders;
CREATE POLICY "Admin full access on account_holders"
  ON public.account_holders FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') IN ('admin', 'owner', 'service_role'))
  WITH CHECK ((auth.jwt() ->> 'role') IN ('admin', 'owner', 'service_role'));

DROP POLICY IF EXISTS "Client can view own holder rows" ON public.account_holders;
CREATE POLICY "Client can view own holder rows"
  ON public.account_holders FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- Vistas relacionadas: positions/operations/cash_balances que un
-- cliente puede ver (incluye cuentas donde es titular O representante).
-- ============================================================

DROP POLICY IF EXISTS "Client can view positions via account_holders" ON public.positions;
CREATE POLICY "Client can view positions via account_holders"
  ON public.positions FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT ah.account_id
      FROM public.account_holders ah
      JOIN public.clients c ON c.id = ah.client_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Client can view operations via account_holders" ON public.operations;
CREATE POLICY "Client can view operations via account_holders"
  ON public.operations FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT ah.account_id
      FROM public.account_holders ah
      JOIN public.clients c ON c.id = ah.client_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Client can view cash_balances via account_holders" ON public.cash_balances;
CREATE POLICY "Client can view cash_balances via account_holders"
  ON public.cash_balances FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT ah.account_id
      FROM public.account_holders ah
      JOIN public.clients c ON c.id = ah.client_id
      WHERE c.auth_user_id = auth.uid()
    )
  );
