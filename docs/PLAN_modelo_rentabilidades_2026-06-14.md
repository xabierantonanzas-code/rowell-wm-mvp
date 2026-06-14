# Plan de implementación — Modelo de rentabilidades (entrega Edgard 13–14 jun 2026)

> Origen: paquete `Claude_outputs/` de Edgard (00–07, fixtures, `metrics.py`).
> Estado del paquete: **VIGENTE / APROBADO por Edgard**. Desbloquea el
> bloqueante externo #1 (modelo matemático 4 rentabilidades → MVP6.1, TWR
> reactivable, X-Ray Tab 3).
> Este documento traduce el spec a tareas sobre el **código actual** del
> dashboard, no es greenfield.

## Estado actual del dashboard vs spec (hallazgos)

- ✅ Taxonomía PLUS/MINUS/NEUTRO existe (`lib/operations-taxonomy.ts`) y cubre los 21 tipos.
- ✅ Rentabilidad **Simple** acumulada correcta (24,29 % en Aurum-077 = CV …226249, cuadra con `FRM-004`).
- ✅ Base de cálculo ya usa valor de posiciones, no patrimonio total (coherente con `D27`).
- ⚠️ **MINUS** usa `gross_amount × fx_rate` (EFECTIVO BRUTO). El spec (`D6`/`FRM-002`) pide `(net_amount + withholding) × fx_rate` = `(REG_OP_23 + REG_OP_27) × REG_OP_24`. La BD **ya tiene** `net_amount` y `withholding` → no requiere migración.
- ⚠️ El "MWR" actual (`mwrPeriods` en `ClientDashboard.tsx`) es en realidad **Modified Dietz**, no la TIR. El spec separa: MWR = IRR exacta (`FRM-006`) y Modified Dietz solo motor interno, **no expuesto** (`D29`).
- ❌ **TWR roto**: muestra +128,69 % en Aurum-077 (real 24,29 %). Toggle TWR/MWR **oculto desde Sprint 0** (`// HIDDEN UNTIL MVP6.1`). TODO existente en `docs/MVP6.1_TODO.md`.
- ❓ Horizontes (`FRM-014`/`D30`): existen `twrPeriods`/`mwrPeriods` por periodo pero sin la mecánica de ventana anclada a snapshots.

---

## Bloque A — Reconciliar lo existente con el spec (correcciones)

- **A1 · Fórmula MINUS (`D6`/`FRM-002`).** En `flowAmountEur` cambiar `gross_amount × fx_rate` → `(net_amount + withholding) × fx_rate`. Actualizar también la lógica embebida en `data/migrations/007_client_summary_mv.sql` (líneas ~25/51). Re-correr `validate-aurum077` (Aurum no tiene MINUS → no debe romper).
  - ⚠️ **Riesgo / decisión Edgard:** cambia cifras de cualquier CV con reembolsos. Validar contra `TC-003` (CV …592271, MINUS + retención) **antes** de mergear.
- **A2 · Base de rentabilidad (`D27`).** Confirmar que MWR/TWR usan `V^pos = Σ POS_13` (sin efectivo CE), no patrimonio total. La acumulada Simple ya cumple.
- **A3 · Renombrado (`D26`).** "Aportado neto" / "Aportaciones netas" → **"Capital invertido"** en UI, `CombinedChart.tsx` y schema KPI (`aportado_neto` → `capital_invertido`).

## Bloque B — Las 4 rentabilidades correctas (núcleo MVP6.1)

- **B1 · MWR = IRR real (`FRM-006`).** Implementar TIR (Newton + bracketing, fallback bisección en `(−0,9999, 10)`), descuento a `t_0`, valor terminal `V^pos`. Sustituye al actual "MWR"-Dietz. Esperado Aurum: 6,48 %/año (32,45 % acum).
- **B2 · TWR encadenado gap-aware (`FRM-007`).** Arreglar el bug. Modified Dietz por subperiodo entre snapshots, desde inception; **excepción gap-aware** (arranca en `s1` + etiqueta "no since-inception") cuando hay hueco. Aurum-077 cae en la excepción (hueco 491 d): TWR 44,89 % / 12,58 % anual desde 2023-01-31.
- **B3 · Modified Dietz interno (`FRM-008`/`D29`).** Queda solo como motor del TWR. **Quitar** como métrica/label de cara al cliente.
- **B4 · Simple anualizada (`FRM-005`).** Añadir donde aplique (Gráfico C).
- **B5 · Anualización (`FRM-012`).** Ventana propia por métrica (TWR desde `twr_start`, no `t_0`). Suprimir si < 1 año.
- **B6 · Reactivar toggle (D20/D23).** Exponer Simple/MWR/TWR una vez B1–B5 correctos y validados. Retirar el `HIDDEN UNTIL MVP6.1`.
- **B7 · Badge `V-010`.** "TWR desde {fecha}, no since-inception" cuando hay hueco.

## Bloque C — Horizontes `FRM-014` (`PEND-014`)

- **C1 · Mecánica de ventana (`D30`).** Fecha teórica por periodo → último snapshot ≤ teórica; degeneración a SI si `t_0 >` teórica; clamp + etiqueta "desde {fecha}" si hueco (`V-010`).
- **C2 · Simple_H / MWR_H / TWR_H (`D31`).** Por ventana.
- **C3 · Conectar a `OUT-007` / `/returns`.** Selector métrica (default MWR) + toggle anualizada en 3Y/5Y/SI. Emitir `value`/`annualized_value`/`window_start`/`is_clamped`/`is_approx`.
- **C4 · Periodos < 1 año:** solo acumulada.

## Bloque D — Datos / pipeline (`D32`/`D33`)

- **D1 · Cadencia `D32`.** Ingesta de viernes semanales + cierre de mes. Verificar loader actual.
- **D2 · Nomenclatura `D33`.** Soportar `AA_MM_DD_Saldo/Pos.xlsx` (fecha del campo `SAL_1`/`POS_1`, **no** del nombre). Edgard ya renombró 411 archivos `CM_Saldo`.
- **D3 · Recarga operaciones.** Edgard unificó `Registro_Operaciones` → 11.535 ops (+1.084). Re-correr `load-operations.mjs`.
- **D4 · `PEND-016`.** Snapshot vacío 2021-02-05: tratar como CE = 0 con aviso de integridad.

## Bloque E — Outputs / contratos (`OUT-001..010`)

- **E1 · KPIs (`OUT-001..004`).** Alinear schema: `patrimonio_actual`, `capital_invertido`, `rentabilidad_acumulada {simple, mwr, twr}`, `rentabilidad_anualizada {mwr, twr}`.
- **E2 · Footer permanente (`D19`).** Avisos `PEND-001` (sin dividendos) + `PEND-003` (TWR aprox.).
- **E3 · Gráficos B/D y tablas.** Contrastar con `OUT-006/008/009/010` (probablemente ya cubierto por MVP6 #10/#2).
- **E4 · `PEND-011`.** ISIN sin tipo inferible → segmento "Otros".

## Bloque F — Validación / QA

- **F1 · Validador multi-CV.** Portar `metrics.py` / `TC-001..010` (11 fixtures) a un validador del dashboard (extender `validate-aurum077.mjs` o nuevo script). Tolerancias del spec: importes ±0,10 €, Simple/MWR ±0,05 pp, TWR ±0,5 pp.
- **F2 · Hook pre-push.** Añadir los nuevos checks.
- **F3 · `PEND-015`.** Badge "flujos netos negativos" + no publicar MWR con `CI ≤ 0` y cartera viva.

---

## Orden sugerido (dependencias)

1. **D** (datos: recarga ops + cadencia/nomenclatura) — base para todo.
2. **A** (correcciones rápidas: MINUS, renombrado) — A1 con validación de Edgard.
3. **B** (las 4 rentabilidades) — el grueso de MVP6.1; depende de A2.
4. **F1** en paralelo con B (validar cada métrica contra fixtures).
5. **C** (horizontes) — depende de B.
6. **E** (contratos/UI) — cierre.

## Fuera de v1 — NO tocar ahora

`PEND-001` (dividendos), `PEND-002` (benchmark/objetivo), `PEND-003` (TWR exacto con snapshots diarios), `PEND-009` (atribución peso×retorno), `PEND-010` (export CSV/PDF).

## Pendiente del lado de Edgard

- `02_data_model.md` y `04_pipeline.md` **aún no existen** (INDEX los marca como próximos pasos). No bloquean (el dashboard tiene su propio schema) pero conviene tenerlos antes de tocar el contrato de datos canónico.
- Validar A1 (MINUS) contra una CV con reembolsos antes de mergear.
