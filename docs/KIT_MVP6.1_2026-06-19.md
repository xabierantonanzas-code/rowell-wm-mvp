# Kit de implementación — MVP6.1 (modelo de rentabilidades)

> **Cómo usar este kit:** ejecuta commit a commit, en orden. Cada commit lleva
> su gate de validación; **no pases al siguiente sin que el gate pase**. Los
> commits marcados 🔒 están bloqueados (Edgard o datos) — no empezar hasta
> levantar el bloqueante. Todo cálculo numérico se valida con
> `node scripts/validate-aurum077.mjs` en tu entorno (en el sandbox de Claude no
> llega a Supabase, por eso esto es un kit y no código aplicado).
>
> **Caso de referencia (Aurum-077, CV …226249):** Simple 24,29 % / 4,98 % anual ·
> MWR 6,48 % anual (32,45 % acum) · TWR 44,89 % / 12,58 % anual *desde 2023-01-31*
> (excepción gap-aware `V-010`, hueco 491 d).

---

## Estado del código (punto de partida)

- ✅ `lib/returns.ts`: `cfExtEur` (FRM-002, MINUS = neto+retención D6), `inceptionDate`
  (FRM-013), `capitalInvertido` (FRM-003), `simpleReturn` (FRM-004), `annualize`
  (FRM-012), `simpleReturnAnnualized` (FRM-005), `mwrIrr`/`irrFromSignedFlows`
  (FRM-006). Funciones puras y testeadas. **No cableadas en UI.**
- ⚠️ `ClientDashboard.tsx`: usa cálculos **inline rotos** — `twrPeriods` (L1108),
  `mwrPeriods` = Modified Dietz mal etiquetado MWR (L1144), `variacion`/
  `rentabilidadPeriodo` (L1296-1348). Solo importa `inceptionDate` e
  `irrFromSignedFlows` (L54), sin usarlos para las cards.
- ⚠️ Toggle TWR/MWR oculto: bloque `HIDDEN UNTIL MVP6.1` (~L1443). `returnMethod`
  state (L950) sigue vivo.
- ✅ "Capital invertido" (D26) ya aplicado (L515, L1553).
- ❌ FRM-007/008 (TWR/Dietz) no existen en `returns.ts` (pendiente Edgard).

---

## Commit 0 — Preparar rama limpia

El árbol tiene WIP sin commitear (footer de versión: `lib/version.ts`,
`next.config.mjs`, 4 líneas de `ClientDashboard.tsx`; scripts `diagnose-flows.mjs`;
`_hist_test.mts` temporal) **y** el cambio de taxonomía PEND-017 ya aplicado por
Claude. Sepáralo antes de empezar:

```bash
rm _hist_test.mts                       # temporal, marcado seguro de borrar
# 1) Commit del WIP de footer en su rama actual (o stash):
git add lib/version.ts next.config.mjs scripts/diagnose-flows.mjs
git commit -m "chore(ui): footer de versión + scripts de diagnóstico (WIP)"
# 2) Rama MVP6.1 desde main:
git checkout main && git pull
git checkout -b feat/mvp6.1-rentabilidades
```

> El cambio de taxonomía (Commit 1) está en el working tree de tu rama actual:
> al cambiar de rama lo arrastras. Aplícalo como Commit 1 en la rama nueva.

---

## Commit 1 — Taxonomía PEND-017 (✅ ya aplicado, falta validar + commitear)

- **Spec:** PEND-017 (Edgard 2026-06-15).
- **Archivo:** `lib/operations-taxonomy.ts`.
- **Cambio (hecho):** `RECEPCION IIC LIBRE PAGO` → `PLUS_TYPES`;
  `SUSCRIPCION FUSION CON IMPACTO FISCAL` y `REEMBOLSO FUSION CON IMPACTO FISCAL`
  → `NEUTRO_TYPES`.
- **Gate:** `node scripts/validate-aurum077.mjs` debe seguir **9/9** (Aurum no
  tiene esas ops → cero impacto). `npx tsc --noEmit` limpio.
- **Commit:** `fix(taxonomy): clasificar 3 tipos PEND-017 (RECEPCION IIC LIBRE PAGO + 2 fusiones fiscales)`
- **Bloqueante:** ninguno.

## Commit 2 — Recargar operaciones unificadas (A-28)

- **Datos, no código.** Excel en `docs/260619_input_Edgard/Raw data semanal/CM_Reg_Ops/`
  (11.535 ops, +1.084 vs anterior).
- **Acción:** `node scripts/load-operations.mjs <ruta Registro_Operaciones.xlsx>`
  (idempotente, upsert).
- **Gate:** recuento de `operations` ≈ 11.535; `validate-aurum077` 9/9 (los flujos
  de Aurum no deben cambiar — su CV no está entre las CVs de las ops nuevas).
- **Commit:** sin commit de código (es carga de BD). Registrar en
  `docs/sessions/2026-06-19.md`.
- **Bloqueante:** ninguno (el Excel ya está en local).

## Commit 3 — Cablear MWR real (FRM-006) y retirar Modified Dietz cliente (D29)

- **Spec:** FRM-006, D29.
- **Archivos:** `components/dashboard/ClientDashboard.tsx`.
- **Cambio:**
  - Sustituir el `mwrPeriods` inline (Modified Dietz, L1144-1210) por
    `irrFromSignedFlows(...)` / `mwrIrr(...)` de `lib/returns.ts`. Pasar los
    flujos firmados con la convención de producción actual (`flowAmountEur`)
    hasta que el Commit 6 (MINUS) esté validado — `irrFromSignedFlows` acepta
    `SignedFlow[]`, así que no fuerza el cambio de MINUS todavía.
  - Sustituir el bloque `variacion`/`rentabilidadPeriodo` (L1296-1348) por las
    funciones puras (no recomponer multiplicativo a mano).
  - Modified Dietz deja de exponerse como métrica (D29): solo quedará como motor
    interno del TWR (Commit 4). Quitar cualquier label "MWR (Modified Dietz)".
- **Gate:** Aurum MWR **6,48 % anual / 32,45 % acum** (±0,05 pp). `tsc` limpio.
- **Commit:** `feat(mvp6.1): MWR real (IRR FRM-006) cableado, retira Modified Dietz cliente (D29)`
- **Bloqueante:** ninguno (FRM-006 ya implementado y testeado).

## Commit 4 — 🔒 TWR encadenado gap-aware (FRM-007/008)

- **Spec:** FRM-007, FRM-008, D28, V-010, V-012, PEND-013, PEND-018.
- **Archivos:** `lib/returns.ts` (nuevas `modifiedDietzSubperiod` FRM-008 +
  `chainedTwr` FRM-007), `ClientDashboard.tsx` (`twrPeriods`, reemplazar el cálculo
  roto de L1108).
- **Cambio:** Modified Dietz por subperiodo entre snapshots, encadenado desde
  inception; **excepción gap-aware** (arranca en primer snapshot `s1` + etiqueta
  "no since-inception") cuando hay hueco > ~1 cadencia. Para Aurum: arranca
  2023-01-31.
- **Gate:** Aurum TWR **44,89 % / 12,58 % anual desde 2023-01-31**; badge `V-010`.
  Validar además ≥ 2 CVs (`TC-002`, `TC-005`) por el artefacto PEND-018.
- **Política (MVP6.1_TODO):** si los inputs no garantizan integridad → fallback
  "Datos insuficientes para TWR", nunca número falso.
- **🔒 Bloqueante (A-30):** Edgard debe enviar la **serie de `V^pos` por snapshot**
  (valor de posiciones en cada viernes + cierre de mes). Sin esa serie en BD no
  hay TWR encadenado. Además el "material adicional de TWR" puede cambiar la ruta
  (ver `PREGUNTAS_edgard_TWR_2026-06-14.md` A1-A3). **No empezar hasta recibirlo.**

## Commit 5 — 🔒 Horizontes FRM-014 (PEND-014)

- **Spec:** FRM-014, D30 (ventana), D31 (Simple por periodo).
- **Archivos:** `lib/returns.ts` (mecánica de ventana + `simpleH`/`mwrH`/`twrH`),
  endpoint `/returns` (`OUT-007`), `ClientDashboard.tsx` (selector por periodo
  MTD/QTD/YTD/1Y/3Y/5Y/SI).
- **Cambio:** por cada periodo, fecha teórica → último snapshot ≤ teórica;
  degeneración a SI si `t_0 >` teórica; clamp + etiqueta "desde {fecha}" si hueco.
  Emitir `value`/`annualized_value`/`window_start`/`is_clamped`/`is_approx`.
  Periodos < 1 año: solo acumulada.
- **Gate:** casos M-08/M-12/M-13 del manual; `TC` por horizonte.
- **🔒 Bloqueante:** depende de la serie de snapshots en BD (mismo dato que A-30 /
  B6) y, para `twrH`, del Commit 4.

## Commit 6 — 🔒 Alinear MINUS a spec (FRM-002 / D6) en producción

- **Spec:** D6, FRM-002.
- **Archivos:** `lib/operations-taxonomy.ts` (`flowAmountEur`: `gross×fx` →
  `(net+retención)×fx`), `data/migrations/007_client_summary_mv.sql` (~L25/L51).
- **Cambio:** alinear producción con `cfExtEur` (ya en `returns.ts`). La BD ya
  tiene `net_amount` y `withholding` → **sin migración de esquema**.
- **Gate:** `validate-aurum077` 9/9 (Aurum no tiene MINUS → no cambia) **y**
  validación manual contra `TC-003` (CV …592271, MINUS + retención).
- **🔒 Bloqueante (A-5):** cambia cifras de toda CV con reembolsos → **requiere OK
  de Edgard** validando `TC-003` antes de mergear.

## Commit 7 — Reactivar toggle Simple/MWR/TWR (D20/D23)

- **Spec:** D20, D23, D29.
- **Archivos:** `ClientDashboard.tsx` (bloque `HIDDEN UNTIL MVP6.1`, ~L1443).
- **Cambio:** exponer Simple/MWR/TWR; **sin** opción Modified Dietz (D29);
  anualizada solo MWR/TWR en 3Y/5Y/SI. Retirar el comentario `HIDDEN`.
- **Gate:** las 3 métricas cuadran con los esperados de Aurum; `tsc` limpio.
- **Bloqueante:** Commits 3 + 4 validados.

## Commit 8 — QA multi-CV (G1)

- **Archivos:** extender `scripts/validate-aurum077.mjs` o nuevo
  `scripts/validate-model.mjs` portando `metrics.py` / `TC-001…010` (11 fixtures).
- **Tolerancias (spec):** importes ±0,10 € · Simple/MWR ±0,05 pp · TWR ±0,5 pp.
- **Gate:** verde en todos los TC disponibles. Añadir al hook pre-push.
- **Bloqueante:** raw `.xlsx` de los fixtures (ya en `Raw data semanal/`) cargados.

## Commit 9 — Retoques de dashboard (F, reunión 14 jun)

- **Archivos:** `ClientDashboard.tsx`, página `/ayuda`, `lib/version.ts` (ya WIP).
- **Cambios (independientes, se pueden hacer ya los no-numéricos):**
  - Indicador "última actualización de datos" (ligado al footer de versión WIP).
  - Disclaimers a la **sección Ayuda** (D19): beta, sin dividendos `PEND-001`,
    TWR aprox. `PEND-003`, fondos sin histórico.
  - 🔒 Media a 10 años + medias ponderadas 3/5/10 a → depende de A-33 (decisión de
    fondos sin histórico) y de los datos del Universo.

---

## Orden y estado

| # | Commit | Estado | Bloqueante |
|---|--------|--------|------------|
| 0 | Rama limpia | Listo | — |
| 1 | Taxonomía PEND-017 | ✅ aplicado, validar+commit | — |
| 2 | Recarga ops 11.535 | Listo | — |
| 3 | MWR real + retirar Dietz | Listo | — |
| 4 | TWR gap-aware | 🔒 | A-30 (serie V^pos + material TWR) |
| 5 | Horizontes FRM-014 | 🔒 | serie snapshots + Commit 4 |
| 6 | MINUS a spec | 🔒 | A-5 (OK Edgard, TC-003) |
| 7 | Reactivar toggle | Pendiente | Commits 3+4 |
| 8 | QA multi-CV | Listo (parcial) | fixtures cargados |
| 9 | Retoques dashboard | Parcial | A-33 (medias 10a) |

**Se puede ejecutar hoy sin Edgard:** 0, 1, 2, 3, 8 (parcial), 9 (no-numéricos).
**Bloqueado hasta A-30 / A-5 / A-33:** 4, 5, 6, y la parte numérica de 9.

## Fuera de MVP6.1 (no tocar)

`PEND-001` dividendos · `PEND-002` benchmark · `PEND-003`/`PEND-018` TWR exacto
(snapshots diarios / artefacto encadenado) · `PEND-009` atribución · `PEND-010`
export · `PEND-012` reconciliación CM vs PF.
