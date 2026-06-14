# Preguntas para Edgard — TWR y cierre de implementación del modelo

> Contexto: Edgard entregó el modelo de rentabilidades (paquete `Claude_outputs/`,
> aprobado) y avisó de que **falta material adicional de TWR**. Estas preguntas
> desbloquean el resto de la implementación. Ya están implementadas y verificadas
> las métricas que NO dependen del TWR (Simple, Simple anualizada, MWR/IRR,
> capital invertido, inception) en `lib/returns.ts`.

## A) TWR — lo que falta de tu lado (prioritario)

1. **¿Qué incluye el material de TWR pendiente?** ¿Es la serie de snapshots de
   `V^pos` por CV (valor de posiciones en cada viernes + fin de mes), una
   metodología nueva, o snapshots intra-mes el día de cada flujo (cerrar
   `PEND-003`)? El TWR encadenado (`FRM-007`) necesita el valor de posiciones en
   **cada** snapshot — sin esa serie no se puede calcular.

2. **`PEND-013` (liquidación diferida en el subperiodo de inception).** ¿Damos
   por definitiva la "ruta robusta gap-aware" (arrancar el TWR en el primer
   snapshot `s1` y usar MWR para el tramo completo SI), o el material nuevo lo
   cambia?

3. **CV …226249 (Aurum-077) cae en la excepción `V-010`** (hueco de 491 días,
   sin snapshots 2021-2022). ¿Mostramos su TWR etiquetado *"desde 2023-01-31, no
   since-inception"*, o lo ocultamos y enseñamos solo MWR para el tramo completo?

## B) Datos que necesito para implementar y validar

4. **Recarga de operaciones.** Unificaste `Registro_Operaciones` a 11.535 ops
   (+1.084). ¿Me pasas ese Excel para recargarlo (`load-operations.mjs`), o ya
   está en una ubicación que cojo yo?

5. **Serie de snapshots en BD.** ¿Los 411 archivos `CM_Saldo` (+ los `Pos`)
   renombrados `AA_MM_DD` van a estar todos cargados en Supabase? El TWR y los
   horizontes (`FRM-014`) dependen de tener la serie completa de `V^pos`.

6. **Validación cruzada (`TC-001…010`).** Para portar tu `metrics.py` a un
   validador del dashboard necesito los raw `.xlsx` de los 11 fixtures (o que
   estén cargados). ¿Los tengo disponibles?

7. **`02_data_model.md` y `04_pipeline.md` aún no existen** (el INDEX los marca
   como próximos pasos). ¿Los vas a enviar? ¿Cambian el contrato de datos o el
   dashboard mantiene su schema actual?

## C) Decisiones de publicación (rápidas)

8. **Fórmula MINUS (`D6`).** El spec usa `(EFECTIVO NETO + RETENCIÓN) × cambio`;
   el dashboard hoy usa `EFECTIVO BRUTO × cambio`. Voy a alinear con el spec,
   pero **cambia cifras en carteras con reembolsos** (Aurum no tiene MINUS, no se
   ve afectado). ¿Validamos contra una CV real con MINUS — p. ej. la de `TC-003`
   (CV …592271) — antes de aplicarlo en producción?

9. **`PEND-015` (MWR con capital invertido ≤ 0 y cartera viva).** Propuesta:
   badge *"flujos netos negativos"* y **no** publicar el MWR por defecto
   (revisión manual). ¿Lo confirmas?

10. **`PEND-016` (snapshot de Saldo vacío del 2021-02-05).** ¿Lo re-descargas de
    CM, o lo tratamos como CE = 0 con aviso de integridad?

---

### Estado de implementación a fecha de estas preguntas

- ✅ `lib/returns.ts` + tests: `FRM-002` (MINUS corregido D6), `FRM-003`,
  `FRM-004`, `FRM-005`, `FRM-006` (MWR/IRR), `FRM-012`, `FRM-013`. Verificado
  contra los valores del spec (Aurum-077: Simple 24,29 % / 4,98 %; MINUS TC-003/004).
- ⏸ `FRM-007`/`FRM-008` (TWR / Modified Dietz): a la espera de **A**.
- ⏸ Cableado en UI, fix del TWR roto y reactivación del toggle: tras **A** + **B**.
- ⏸ Horizontes `FRM-014` (`OUT-007`): tras tener la serie de snapshots (**B5**).
