-- ============================================================
-- 006_account_profile: perfil de inversion por cuenta de valores
-- ============================================================
--
-- Edgard MVP6 punto 9b: muchas CVs no tienen categoria de perfil
-- definida. Anadimos una columna estructurada para poder filtrar
-- y agrupar por estrategia.
--
-- Valores esperados:
--   conservador  -> bajo riesgo
--   moderado     -> riesgo medio
--   agresivo     -> alto riesgo
--   decidida     -> equivalente a agresivo en algunas convenciones
--   proteccion   -> proteccion financiera
--   otros        -> sin categorizar
--
-- Backfill heuristico desde accounts.label si contiene una palabra clave.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS profile TEXT
    CHECK (profile IS NULL OR profile IN (
      'conservador', 'moderado', 'agresivo', 'decidida', 'proteccion', 'otros'
    ));

-- Backfill desde label
UPDATE public.accounts
SET profile = CASE
  WHEN label ILIKE '%conserv%' THEN 'conservador'
  WHEN label ILIKE '%moder%' THEN 'moderado'
  WHEN label ILIKE '%agres%' THEN 'agresivo'
  WHEN label ILIKE '%decid%' THEN 'decidida'
  WHEN label ILIKE '%protec%' THEN 'proteccion'
  ELSE NULL
END
WHERE profile IS NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_profile
  ON public.accounts (profile);
