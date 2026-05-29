# Plan de cierre de feedback + trazabilidad

> Objetivo: cerrar los puntos abiertos de Edgard (8/21/29 may) en un orden que respete dependencias y barreras MVP, y dejar un sistema para que el avance sea trazable versión a versión.
> Base: `FEEDBACK_TRACKER.md` (estados verificados contra código, 29 may 2026).

---

## A. Sistema de trazabilidad (transversal, se monta primero)

Sin esto, cerrar puntos vuelve a ser invisible para Edgard. Cuatro reglas:

1. **`FEEDBACK_TRACKER.md` es la fuente única.** ID estable por punto (M8-x, R21-x, R29-x). Se añaden dos columnas: **Versión resuelto** (tag/commit) y **Fecha cierre**.
2. **Commits citan el ID.** Footer del commit: `Closes R21-3, R21-10`. (Sin Co-Author trailer, ADR explícito.)
3. **Por versión, un bloque de CHANGELOG** con los IDs cerrados: `v7 — cierra R21-3, R21-8, R21-10, R21-13`. Vive en el repo correspondiente.
4. **Cada status a Edgard cita IDs cerrados** en esa versión. Es lo que ataca directamente su queja ("no se actualiza lo que comento").

Session logging (`docs/sessions/`) referencia el ID en cada hito. Opcional más adelante: artifact visual que lea el tracker y pinte abierto/en curso/cerrado por ronda.

---

## B. Fases de cierre

Orden por dependencia, no por importancia. Cada fase = uno o pocos commits limpios. `validate-aurum077` debe pasar en cada push del dashboard.

### Fase 0 — Trazabilidad (≈0,5 d)
Montar lo de la sección A. Sin código de producto.

### Fase 1 — Pipeline: clasificación unificada *(keystone)* (≈1,5–2 d)
Repo: `rowell-funds-pipeline-python`.
- **R21-3 + R21-10:** una única función `clasificar_fondo()` dentro de `actualiza_universo_v5.py` que devuelva `_status`, `xray_disponible` y `xray_nota` de forma coherente a partir de los datos reales del fondo. Plegar `clean_v6.py` dentro del flujo (o invocarlo desde él); que no haya paso manual aparte.
- **R21-8:** que **todo** `PARTIAL` reciba una `xray_nota` con el motivo.
- **R21-13:** si `ISIN_es_aproximacion == "SI"`, añadir aviso a `xray_nota`.
- Validación: correr el Universo completo y diff contra el `v6_clean` actual; confirmar que la clasificación es igual o mejor. Spot-check de 5–10 fondos.
- Commit: `refactor(pipeline): clasificación unificada de estado` → **Closes R21-3, R21-8, R21-10, R21-13**.

### Fase 2 — Pipeline: robustez de lectura (≈1–1,5 d)
- **R21-12:** corregir la lógica `ISIN_match` para LU0076315455 (OK / aprox=NO) y LU2694991766 (MISMATCH_HEADER / aprox=SI). Añadir test de regresión con esos 2 ISINs.
- **R21-7 + R21-9:** comparar contra el Excel del mes anterior y reintentar automáticamente los fondos que (a) regresan (OK→otro) o (b) fallan transitoriamente; lo que siga fallando va a un informe, no se pierde en silencio. Confirmar que LU1883854199 y LU1883314244 acaban OK.
- Commit: `feat(pipeline): retry por regresión mes-a-mes + fix ISIN_match` → **Closes R21-7, R21-9, R21-12**.

### Fase 3 — Dashboard: quick win (≈0,5 d, independiente)
Repo: `rowell dashboard`.
- **R29-4:** reordenar para que POSICIONES vaya antes del X-Ray en `ClientDashboard.tsx`.
- Commit: `fix(dashboard): Posiciones antes de X-Ray` → **Closes R29-4**. Correr `validate-aurum077`.

### Fase 4 — Pipeline: rentabilidad 10 años (≈1–2 d)
- **R29-1:** leer y persistir la rentabilidad por año natural de los últimos 10 años en el Universo (columnas nuevas).
- Commit: `feat(pipeline): rentabilidad anual 10y en Universo` → **Closes R29-1**.

### Fase 5 — Dashboard: X-Ray con datos reales *(la grande)* (≈3–5 d)
Depende de Fase 1 (flags limpias en el Universo).
- **R21-14 / R29-3:** conectar el X-Ray a la cartera real del cliente. Query a `funds_universe` (respetar schema cross-repo en `docs/SCHEMA.md`), mapear posiciones→ISIN→datos del Universo, agregación look-through. Quitar los datos hardcoded de `XRayTab.tsx`.
- **R21-11:** bloque de avisos al principio del X-Ray listando los fondos con singularidades (usando `xray_disponible`/`xray_nota`); no descartar ningún ISIN.
- Commit(s): `feat(dashboard): X-Ray cartera real + avisos` → **Closes R21-14, R29-3, R21-11**.

### Fase 6 — Dashboard: 2ª página histórica X-Ray (≈2–3 d) — **bloqueada**
Depende de Fase 4 (R29-1) **y** del modelo de Edgard.
- **R29-2:** replicar la 2ª página de Morningstar (rent. histórica), salvo "Rentab. por periodos %". Aplicar las aproximaciones que pidió Edgard (línea recta año a año; para años sin dato de un fondo, media de los demás fondos de la cartera).
- Commit: `feat(dashboard): X-Ray página histórica` → **Closes R29-2**.

---

## C. Bloqueantes de Edgard (no avanzan sin ellos)

- **Paquete MDs — modelo de las 4 rentabilidades** (acumulada, acumulada en posiciones actuales, MWR, TWR) con ejemplos numéricos → **bloquea Fase 6** y la reactivación de TWR/MWR en la UI.
- **Excel Registro_Inversores** actualizado (sin DNIs, multi-titular, perfil por CV) → no está en este set de feedback, pero bloquea multi-titular cuando se retome.

---

## D. Secuencia sugerida

```
Fase 0 (trazabilidad)
  └─ Fase 1 (clasificación unificada) ──┬─ Fase 2 (robustez lectura)
                                        └─ Fase 5 (X-Ray real) ── Fase 6* (histórica)
Fase 3 (quick win) — en cualquier momento
Fase 4 (10y) ───────────────────────────── Fase 6* (histórica)

* Fase 6 espera además el modelo de Edgard.
```

Camino crítico hacia "X-Ray con datos reales": **0 → 1 → 5**. El resto (2, 3, 4) es paralelizable.

Estimación bruta: ~9–13 días efectivos. Las fases de pipeline (1, 2, 4) son autónomas; las de dashboard (3, 5, 6) requieren que pase `validate-aurum077`.
