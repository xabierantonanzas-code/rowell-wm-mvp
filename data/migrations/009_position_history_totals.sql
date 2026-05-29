-- ============================================================
-- 009_position_history_totals.sql
-- ============================================================
-- Vista agregada para el gráfico de evolución del admin ("Todos los
-- clientes"). Sustituye el cálculo en JS de `_getAllPositionHistory`, que
-- bajaba las 22k+ filas de `positions` y lanzaba una query por cada fecha
-- de snapshot en serie (~20 s). Aquí Postgres agrega de un tiro.
--
-- `security_invoker = true`: la vista se ejecuta con los permisos y la RLS
-- del usuario que consulta (no del owner). Así mantiene EXACTAMENTE la misma
-- semántica de visibilidad que el código actual (que ya lee `positions` con
-- el cliente autenticado). No abre ninguna superficie nueva.
--
-- Aplicación: MANUAL en el SQL Editor de Supabase. Idempotente.
-- ============================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_position_history_totals
WITH (security_invoker = true) AS
SELECT
    snapshot_date,
    SUM(position_value) AS total_value
FROM public.positions
GROUP BY snapshot_date;

COMMENT ON VIEW public.v_position_history_totals IS
    'AUM total por fecha de snapshot (SUM(position_value) GROUP BY snapshot_date). Para el gráfico agregado del admin. security_invoker: respeta la RLS del consultante.';

-- La vista hereda la RLS de positions vía security_invoker. Concedemos SELECT
-- al rol autenticado (igual que el acceso actual a positions).
GRANT SELECT ON public.v_position_history_totals TO authenticated;

COMMIT;
