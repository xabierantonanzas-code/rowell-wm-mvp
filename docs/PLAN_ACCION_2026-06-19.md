# Plan de acción — 19 jun 2026

> **Fuentes:** (1) transcripción reunión Edgard 14 jun 2026 (mail "Reunion Edgard
> 14 junio 2026"), (2) entrega del modelo de rentabilidades
> `docs/260619_input_Edgard/Claude_outputs/` (VIGENTE / APROBADO por Edgard).
> Consolida y actualiza `PLAN_modelo_rentabilidades_2026-06-14.md` y
> `PREGUNTAS_edgard_TWR_2026-06-14.md` con lo hablado en la reunión.

## Dónde estamos (1 párrafo)

El modelo matemático de rentabilidades está **aprobado** y entregado (desbloquea
el bloqueante externo #1: MVP6.1 / TWR reactivable / X-Ray Tab 3). Las métricas
que **no** dependen del TWR (Simple, Simple anualizada, MWR/IRR, capital
invertido, inception) ya están implementadas y verificadas en `lib/returns.ts`.
Quedan tres frentes: **(a)** completar la implementación de TWR + horizontes,
parcialmente **bloqueado por Edgard** (material adicional de TWR + `PEND-018`
abierto); **(b)** absorber la nueva cadencia de datos (semanal + cierre de mes,
ops unificadas a 11.535, snapshots renombrados); **(c)** retoques de dashboard y
tareas operativas/negocio salidas de la reunión. Dato de presión real: el
dashboard de **Aurum muestra ~70 k€ de ganancia cuando la real ya va por ~120 k€**
porque el modelo no está actualizado con los datos nuevos.

---

## A. Bloqueantes — pendiente de Edgard (no avanzo sin esto)

- [ ] **A1 · Material adicional de TWR.** Edgard avisó de que falta. Necesito
      saber qué es: ¿la serie de `V^pos` por CV en cada snapshot, metodología
      nueva, o snapshots intra-mes el día de cada flujo? Sin la serie de valor de
      posiciones por snapshot **no se puede calcular el TWR encadenado**
      (`FRM-007`). → Preguntas 1–3 de `PREGUNTAS_edgard_TWR_2026-06-14.md`.
- [ ] **A2 · Los 3 Excel completos** (Saldos + Posiciones + Operaciones). En la
      reunión: Saldos ya están (~412 archivos), **faltan Posiciones**. Sin ellos
      no actualizo el modelo ni corrijo el caso Aurum.
- [ ] **A3 · Decisión "fondos sin histórico" (medias 10 años).** Edgard la
      calificó de "filosófica": un fondo que no existía en el año base ¿pesa 0
      (→ es otra cartera) o se extrapola su rentabilidad? Bloquea el cálculo
      fiable de las medias ponderadas de cartera.
- [ ] **A4 · `02_data_model.md` y `04_pipeline.md`** — el INDEX los marca como
      "NO EXISTE AÚN". No bloquean código (el dashboard tiene su schema) pero
      conviene tenerlos antes de tocar el contrato de datos canónico.
- [ ] **A5 · Validación A1-MINUS.** Antes de aplicar el cambio de fórmula MINUS
      en producción, validar contra una CV real con reembolsos (`TC-003`, CV
      …592271). Pedir OK a Edgard (cambia cifras de carteras con MINUS).

> **Nota de logística (reunión):** el envío de Excel se atasca porque el agente
> solo crea *drafts* y no manda correo sin OK manual, y el escritorio de Mapfre
> cierra a los 20 min. Es límite de la herramienta, no de Mapfre. Edgard los
> manda a mano. Recordatorio: pedirle que los envíe **sin comprimir** (.zip lo
> marcan los filtros; <10 MB no da problema).

---

## B. Datos y pipeline (base, desbloquea el resto) — Xabier

- [ ] **B1 · Recargar operaciones.** Edgard unificó `Registro_Operaciones` →
      **11.535 ops** (+1.084). Re-correr `load-operations.mjs` con el Excel nuevo.
- [ ] **B2 · Cadencia `D32`.** Adaptar ingesta a **viernes semanales + cierre de
      cada mes natural** (hasta 5 lecturas/mes). Verificar el loader actual.
- [ ] **B3 · Nomenclatura `D33`.** Soportar `AA_MM_DD_Saldo/Pos.xlsx`; fecha
      operativa del campo `SAL_1`/`POS_1`, **nunca** del nombre. Edgard ya
      renombró 411 Saldo + 411 Pos.
- [ ] **B4 · Snapshots vacíos `D34`/`V-011`.** Excluir archivos de 0 filas (no
      sintetizar punto en 0). Casos: Saldo 2021-02-05, Pos 2019-11-15.
- [ ] **B5 · Revisión del modelo por la nueva frecuencia.** Acordado en reunión:
      una vez lleguen los Excel, revisar si la densidad semanal obliga a
      rediseñar algo (ojo: agrava `PEND-018`, el artefacto del TWR con más
      fronteras de subperiodo). Si hay cambios relevantes, **re-enviar los MD a
      Edgard**.
- [ ] **B6 · Cargar serie completa de `V^pos` en Supabase** (410 fechas con
      Saldo+Pos). El TWR y los horizontes (`FRM-014`) dependen de ella.

## C. Correcciones para alinear con el spec — Xabier

- [ ] **C1 · Fórmula MINUS (`D6`/`FRM-002`).** En `flowAmountEur`:
      `gross_amount × fx_rate` → `(net_amount + withholding) × fx_rate`. Sin
      migración (la BD ya tiene `net_amount` y `withholding`). Actualizar también
      `data/migrations/007_client_summary_mv.sql`. **Ver A5** antes de mergear.
- [ ] **C2 · Base de rentabilidad (`D27`).** Confirmar que MWR/TWR usan
      `V^pos = Σ POS_13` (sin efectivo CE). La Simple acumulada ya cumple.
- [ ] **C3 · Renombrado (`D26`).** "Aportado neto"/"Aportaciones netas" →
      **"Capital invertido"** en UI, `CombinedChart.tsx` y schema KPI.
- [ ] **C4 · Tipos nuevos taxonomía (`PEND-017`, resuelto por Edgard).**
      `RECEPCION IIC LIBRE PAGO` → PLUS; `SUSCRIPCION/REEMBOLSO FUSION CON
      IMPACTO FISCAL` → NEUTRO. Reflejar en `lib/operations-taxonomy.ts`.

## D. Las 4 rentabilidades — núcleo MVP6.1 — Xabier

- [ ] **D1 · MWR = IRR real (`FRM-006`).** ✅ ya en `lib/returns.ts`. Cablear a UI
      sustituyendo el "MWR"-Dietz actual. Esperado Aurum: 6,48 %/año.
- [ ] **D2 · TWR encadenado gap-aware (`FRM-007`).** Arreglar el bug (Aurum
      muestra +128,69 % vs 24,29 % real). Modified Dietz por subperiodo desde
      inception; excepción gap-aware. **Depende de A1 + B6.** Aurum cae en
      excepción `V-010` (hueco 491 d) → "TWR desde 2023-01-31, no since-inception".
- [ ] **D3 · Modified Dietz interno (`D29`).** Solo motor del TWR. **Quitar** como
      métrica/label de cara al cliente.
- [ ] **D4 · Simple anualizada (`FRM-005`) y anualización (`FRM-012`).** Ventana
      propia por métrica; suprimir si < 1 año.
- [ ] **D5 · Reactivar toggle Simple/MWR/TWR (`D20`/`D23`).** Retirar
      `// HIDDEN UNTIL MVP6.1` una vez D1–D4 validados.
- [ ] **D6 · Política de integridad TWR.** Fallback "Datos insuficientes para TWR"
      en vez de número falso (`MVP6.1_TODO.md`). Badge `V-010`/`V-012`.

## E. Horizontes `FRM-014` (`PEND-014`) — Xabier

- [ ] **E1 · Mecánica de ventana (`D30`).** Fecha teórica por periodo → último
      snapshot ≤ teórica; degeneración a SI; clamp + etiqueta "desde {fecha}".
- [ ] **E2 · Simple_H / MWR_H / TWR_H (`D31`).** Por ventana. Conectar a `OUT-007`
      y `/returns` (selector métrica default MWR + toggle anualizada en 3Y/5Y/SI).
- [ ] **E3 · Periodos < 1 año:** solo acumulada. **Depende de D + B6.**

## F. Retoques de dashboard (de la reunión) — Xabier

- [ ] **F1 · Tabla de fondos: añadir media a 10 años** (hoy 3 y 5; el dato cubre
      2016–2025). La de 5 años salió de Morningstar.
- [ ] **F2 · Medias ponderadas de cartera a 3/5/10 años** (peso de cada fondo, no
      media simple). **Depende de A3** para los fondos sin histórico.
- [ ] **F3 · Indicador "última actualización de datos"** visible (arriba izq.).
      Confirmar si ya existe y extenderlo.
- [ ] **F4 · Sección de Ayuda = disclaimers.** Mover ahí los avisos de beta,
      método de cálculo, fondos sin histórico, TWR aprox., sin dividendos. En vez
      de ensuciar los gráficos. (cubre `D19` footer + Ayuda).
- [ ] **F5 · Columnas vacías de fondos** (ej. sector de Tesla en blanco). Baja
      prioridad — pedirlas en la próxima iteración del pipeline.
- [ ] **F6 · Pulido estético** para que entre por los ojos (Edgard lo enseñará a
      clientes).

## G. Validación / QA — Xabier

- [ ] **G1 · Validador multi-CV.** Portar `metrics.py` / `TC-001…010` (11
      fixtures) a un validador del dashboard. Tolerancias: importes ±0,10 €,
      Simple/MWR ±0,05 pp, TWR ±0,5 pp.
- [ ] **G2 · Hook pre-push** con los nuevos checks (mantener `validate-aurum077`
      9/9).
- [ ] **G3 · `PEND-015`.** Badge "flujos netos negativos" + no publicar MWR con
      `CI ≤ 0` y cartera viva.

---

## H. Negocio / no-técnico (de la reunión) — Edgard

- [ ] **H1 · Reunión contractual cliente Lleida (jueves).** Estructura: sociedad
      compartida con dividendo vs. colaboración con retrocesión de %. (Edgard
      inclinado a la segunda.)
- [ ] **H2 · Probar él mismo el upload** desde la pestaña del dashboard el
      viernes — validar que la funcionalidad la puede usar un tercero.
- [ ] **H3 · Revisar la página y mandar comentarios.**
- [ ] **H4 · Marketing:** Facebook re-habilitado esta semana, empujar.

---

## Orden de ejecución sugerido

1. **A** — destrabar a Edgard (material TWR, Excel, decisión 10y). En paralelo a todo.
2. **B** — datos: recarga ops + cadencia/nomenclatura + serie `V^pos`. Base de todo.
3. **C** — correcciones rápidas (MINUS con OK de Edgard, renombrado, taxonomía).
4. **D** — las 4 rentabilidades (grueso MVP6.1). D2/TWR depende de A1+B6.
5. **G1** en paralelo con D (validar cada métrica contra fixtures).
6. **E** — horizontes (depende de D).
7. **F** — retoques de dashboard (independientes; F2 depende de A3).
8. **H** — frente Edgard, no bloquea código.

## Fuera de v1 — NO tocar ahora

`PEND-001` (dividendos), `PEND-002` (benchmark/objetivo), `PEND-003`/`PEND-018`
(TWR exacto con snapshots diarios / artefacto encadenado — análisis en detalle
aparte), `PEND-009` (atribución peso×retorno), `PEND-010` (export CSV/PDF),
`PEND-012` (reconciliación CM vs Portal Financiero).
