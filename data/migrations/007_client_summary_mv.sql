-- ============================================================
-- 007_client_summary_mv: vista materializada para admin
-- ============================================================
--
-- MVP6 Prioridad 2: la carga del /admin global recalcula cada vez
-- sobre ~22k posiciones + ~10k operaciones. Solucion: vista
-- materializada que se refresca SOLO al subir datos nuevos (desde
-- el upload route) y se consulta en ms.
--
-- IMPORTANTE:
-- - NO depende de account_holders (migracion 005 pendiente). Usa
--   accounts.client_id legacy directamente.
-- - GRANT SELECT solo a service_role (los totales de todos los
--   clientes son sensibles). El admin/page.tsx consulta con el
--   admin client tras verificar rol owner/admin.
-- - Taxonomia PLUS/MINUS replicada en SQL. Mantener sincronizada
--   con lib/operations-taxonomy.ts si se cambia en algun momento.
--
-- Aplicar: pegar este fichero en Supabase Dashboard -> SQL Editor.

-- -----------------------------------------------------------------
-- Taxonomia PLUS / MINUS replicada como funcion inmutable
-- -----------------------------------------------------------------
-- PLUS  -> usa CONTRAVALOR EFECTIVO NETO (eur_amount)
-- MINUS -> usa EFECTIVO BRUTO * CAMBIO DIVISA (gross_amount * fx_rate)
-- NEUTRO -> 0

CREATE OR REPLACE FUNCTION public.flow_amount_eur(
  op_type  TEXT,
  eur_amt  NUMERIC,
  gross_amt NUMERIC,
  fx       NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t TEXT := UPPER(TRIM(COALESCE(op_type, '')));
BEGIN
  -- PLUS: sumar eur_amount (positivo)
  IF t IN (
    'SUSCRIPCIÓN FONDOS INVERSIÓN',
    'COMPRA RV CONTADO',
    'COMPRA SICAVS',
    'RECEPCION INTERNA IIC LP',
    'SUSC.TRASPASO EXT.'
  ) THEN
    RETURN ABS(COALESCE(eur_amt, 0));
  END IF;

  -- MINUS: restar gross_amount * fx_rate (o eur_amount si no hay gross)
  IF t IN (
    'VENTA RV CONTADO',
    'LIQUIDACION IICS',
    'TRASPASO INTERNO IIC LP',
    'REEMBOLSO FONDO INVERSIÓN',
    'REEMBOLSO OBLIGATORIO IIC',
    'REEMBOLSO POR TRASPASO EXT.'
  ) THEN
    IF gross_amt IS NOT NULL AND gross_amt <> 0 THEN
      RETURN - (ABS(gross_amt) * COALESCE(fx, 1));
    ELSE
      RETURN - ABS(COALESCE(eur_amt, 0));
    END IF;
  END IF;

  -- NEUTRO
  RETURN 0;
END;
$$;

-- -----------------------------------------------------------------
-- Vista materializada por cliente: un row por cliente con sus KPIs
-- -----------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.client_summary CASCADE;

CREATE MATERIALIZED VIEW public.client_summary AS
WITH last_snapshot AS (
  SELECT MAX(snapshot_date) AS dt FROM public.positions
),
client_accounts AS (
  -- Legacy: accounts.client_id (1 cliente = N cuentas)
  SELECT a.client_id, a.id AS account_id
  FROM public.accounts a
  WHERE a.client_id IS NOT NULL
),
position_value AS (
  SELECT ca.client_id,
         COALESCE(SUM(p.position_value), 0) AS valor_cartera,
         COUNT(p.id) AS num_posiciones
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
net_contribs AS (
  -- Aportaciones netas reales (PLUS-MINUS) por cliente, sobre TODO
  -- el historico de operaciones
  SELECT ca.client_id,
         COALESCE(SUM(public.flow_amount_eur(
           o.operation_type, o.eur_amount, o.gross_amount, o.fx_rate
         )), 0) AS aportaciones_netas
  FROM client_accounts ca
  LEFT JOIN public.operations o ON o.account_id = ca.account_id
  GROUP BY ca.client_id
),
account_counts AS (
  SELECT client_id, COUNT(DISTINCT account_id) AS num_cuentas
  FROM client_accounts
  GROUP BY client_id
)
SELECT
  c.id                                     AS client_id,
  c.full_name,
  c.email,
  COALESCE(pv.valor_cartera, 0)            AS valor_cartera,
  COALESCE(cv.saldo_efectivo, 0)           AS saldo_efectivo,
  COALESCE(pv.valor_cartera, 0)
    + COALESCE(cv.saldo_efectivo, 0)       AS patrimonio_total,
  COALESCE(nc.aportaciones_netas, 0)       AS patrimonio_invertido,
  COALESCE(pv.valor_cartera, 0)
    - COALESCE(nc.aportaciones_netas, 0)   AS rentabilidad_acumulada_eur,
  CASE
    WHEN COALESCE(nc.aportaciones_netas, 0) > 0 THEN
      ROUND(
        ((COALESCE(pv.valor_cartera, 0) - COALESCE(nc.aportaciones_netas, 0))
         / COALESCE(nc.aportaciones_netas, 0)) * 100, 2
      )
    ELSE 0
  END                                      AS rentabilidad_acumulada_pct,
  COALESCE(ac.num_cuentas, 0)              AS num_cuentas,
  COALESCE(pv.num_posiciones, 0)           AS num_posiciones,
  (SELECT dt FROM last_snapshot)           AS ultima_fecha
FROM public.clients c
LEFT JOIN position_value pv ON pv.client_id = c.id
LEFT JOIN cash_value     cv ON cv.client_id = c.id
LEFT JOIN net_contribs   nc ON nc.client_id = c.id
LEFT JOIN account_counts ac ON ac.client_id = c.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_summary_client_id
  ON public.client_summary (client_id);

CREATE INDEX IF NOT EXISTS idx_client_summary_patrimonio_total
  ON public.client_summary (patrimonio_total DESC);

-- -----------------------------------------------------------------
-- Vista agregada GLOBAL: un unico row con los totales del sistema
-- -----------------------------------------------------------------
-- Esto es lo que consume /admin en vista "Todos los clientes" y
-- lo que mas rapido tiene que cargar.

DROP MATERIALIZED VIEW IF EXISTS public.global_kpis CASCADE;

CREATE MATERIALIZED VIEW public.global_kpis AS
SELECT
  COUNT(*)                                 AS num_clientes,
  COUNT(*) FILTER (WHERE valor_cartera > 0) AS num_clientes_con_datos,
  SUM(valor_cartera)                       AS aum_total,
  SUM(saldo_efectivo)                      AS saldo_total,
  SUM(patrimonio_total)                    AS patrimonio_total,
  SUM(patrimonio_invertido)                AS patrimonio_invertido,
  SUM(valor_cartera) - SUM(patrimonio_invertido) AS rentabilidad_acumulada_eur,
  CASE
    WHEN SUM(patrimonio_invertido) > 0 THEN
      ROUND(
        ((SUM(valor_cartera) - SUM(patrimonio_invertido)) / SUM(patrimonio_invertido)) * 100,
        2
      )
    ELSE 0
  END                                      AS rentabilidad_acumulada_pct,
  SUM(num_cuentas)                         AS num_cuentas,
  SUM(num_posiciones)                      AS num_posiciones,
  MAX(ultima_fecha)                        AS ultima_fecha
FROM public.client_summary;

-- global_kpis es UNA sola fila, no necesita indices pero si unique
-- para permitir REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_kpis_single
  ON public.global_kpis ((1));

-- -----------------------------------------------------------------
-- Funcion de refresh (llamada desde upload route tras cada carga)
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_client_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Refrescar ambas MVs en orden. Si CONCURRENTLY falla (primera
  -- vez o tabla muy pequena), hacer refresh bloqueante.
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_summary;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.client_summary;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.global_kpis;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.global_kpis;
  END;
END;
$$;

-- -----------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------
-- Las vistas materializadas contienen agregados sensibles (AUM
-- global, totales por cliente). NO damos SELECT a authenticated;
-- solo a service_role. El admin/page.tsx consulta con admin client
-- tras verificar rol owner/admin (defensa en profundidad).

REVOKE ALL ON public.client_summary FROM PUBLIC, authenticated;
REVOKE ALL ON public.global_kpis    FROM PUBLIC, authenticated;

GRANT SELECT ON public.client_summary TO service_role;
GRANT SELECT ON public.global_kpis    TO service_role;

GRANT EXECUTE ON FUNCTION public.refresh_client_summary() TO service_role;

-- -----------------------------------------------------------------
-- Refresco inicial para poblar las vistas tras crearlas
-- -----------------------------------------------------------------

REFRESH MATERIALIZED VIEW public.client_summary;
REFRESH MATERIALIZED VIEW public.global_kpis;
