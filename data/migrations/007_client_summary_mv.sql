-- ============================================================
-- 007_client_summary_mv: vista materializada para listado admin
-- ============================================================
--
-- MVP6 prioridad 2: la lista de clientes en /admin necesita pintar
-- valor_cartera, ultima_fecha y num_cuentas por cliente sin recalcular
-- todo en cada render. Vista materializada + funcion de refresh +
-- llamada tras cada upload (lo hace el route).

DROP MATERIALIZED VIEW IF EXISTS public.client_summary;

CREATE MATERIALIZED VIEW public.client_summary AS
WITH last_snapshot AS (
  SELECT MAX(snapshot_date) AS dt FROM public.positions
),
holders AS (
  -- Si existe account_holders (migracion 005) usa esa; si no, fallback
  -- via accounts.client_id legacy.
  SELECT ah.client_id, ah.account_id
  FROM public.account_holders ah
  UNION
  SELECT a.client_id, a.id
  FROM public.accounts a
  WHERE a.client_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.account_holders ah2
      WHERE ah2.client_id = a.client_id AND ah2.account_id = a.id
    )
),
client_accounts AS (
  SELECT DISTINCT client_id, account_id FROM holders
),
position_value AS (
  SELECT ca.client_id,
         COALESCE(SUM(p.position_value), 0) AS valor_cartera
  FROM client_accounts ca
  LEFT JOIN public.positions p
    ON p.account_id = ca.account_id
   AND p.snapshot_date = (SELECT dt FROM last_snapshot)
  GROUP BY ca.client_id
),
cash_value AS (
  SELECT ca.client_id,
         COALESCE(SUM(cb.balance), 0) AS saldo_efectivo
  FROM client_accounts ca
  LEFT JOIN public.cash_balances cb
    ON cb.account_id = ca.account_id
   AND cb.snapshot_date = (SELECT dt FROM last_snapshot)
  GROUP BY ca.client_id
),
account_counts AS (
  SELECT client_id, COUNT(DISTINCT account_id) AS num_cuentas
  FROM client_accounts
  GROUP BY client_id
)
SELECT
  c.id            AS client_id,
  c.full_name,
  c.email,
  COALESCE(pv.valor_cartera, 0) + COALESCE(cv.saldo_efectivo, 0) AS patrimonio_total,
  COALESCE(pv.valor_cartera, 0) AS valor_cartera,
  COALESCE(cv.saldo_efectivo, 0) AS saldo_efectivo,
  COALESCE(ac.num_cuentas, 0)   AS num_cuentas,
  (SELECT dt FROM last_snapshot) AS ultima_fecha
FROM public.clients c
LEFT JOIN position_value pv ON pv.client_id = c.id
LEFT JOIN cash_value    cv ON cv.client_id = c.id
LEFT JOIN account_counts ac ON ac.client_id = c.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_summary_client_id
  ON public.client_summary (client_id);

CREATE INDEX IF NOT EXISTS idx_client_summary_patrimonio
  ON public.client_summary (patrimonio_total DESC);

-- Funcion para refrescar concurrentemente (no bloquea lecturas)
CREATE OR REPLACE FUNCTION public.refresh_client_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_summary;
EXCEPTION WHEN OTHERS THEN
  -- Si no se puede concurrentemente (primera vez), hacerlo bloqueante
  REFRESH MATERIALIZED VIEW public.client_summary;
END;
$$;

GRANT SELECT ON public.client_summary TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_client_summary() TO service_role;
