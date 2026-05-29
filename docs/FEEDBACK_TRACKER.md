# Tracker de feedback de Edgard — estado VERIFICADO contra código

> **Ubicación canónica:** `rowell-shared/FEEDBACK_TRACKER.md` (carpeta común local de los repos Rowell, en tu escritorio; Edgard NO tiene acceso a carpetas/repos — solo recibe entregables por email). Las copias en `rowell dashboard/docs/`, `rowell-funds-pipeline-python/docs/` y `Rowell Patrimonios/comunicaciones/` son réplicas; al actualizar, partir de la de `rowell-shared`.
> **Relación con `rowell-shared/trazabilidad_feedback_edgard_may2026.md`:** aquel cubre el ciclo v5→v6 (feedback del 8 may). Este lo extiende con el feedback del 21 may y 29 may y corrige los estados con verificación contra código.
> Fuente del feedback: correos de Edgard (8 may, 21 may) + reunión 28 may + correo X-Ray (29 may 2026).
> Estado verificado leyendo el código real: `rowell-funds-pipeline-python` (entrypoint `actualiza_universo_v5.py`, internamente "v6") y el dashboard (`components/dashboard/XRayTab.tsx`, `ClientDashboard.tsx`).
> Generado / verificado: 2026-05-29.

## Leyenda

- ✅ **HECHO** — implementado en el flujo principal y/o validado por Edgard.
- 🟡 **PARCIAL** — empezado, pero no cubre todo el caso o vive fuera del flujo principal.
- 🔴 **NO** — no implementado.
- 🔜 **PRÓXIMA FASE** — no hecho, pero por secuencia planificada (X-Ray con datos reales).

---

## Tabla — estado verificado

| ID | Fecha | Punto | Estado | Evidencia (verificada en código) |
|----|-------|-------|--------|----------------------------------|
| M8-1 | 8 may | Leer los 13 fondos `DATOS_VACIOS` | ✅ | `actualiza_universo_v5.py:259-273` (`ISIN_TO_SECID_FALLBACK`) + `procesar_fondo:381-390`. En el flujo principal |
| M8-2/3 | 8 may | `NO_ENCONTRADO`/`PARTIAL` → `xray_disponible=FALSE` + nota | ✅ | `procesar_fondo:690-713`; motivos en `ISIN_TO_MOTIVO_NO_ENCONTRADO:281-293` |
| M8-4 | 8 may | MISMATCH por ISIN del *header* de la ficha | ✅ | `fetch_morningstar_header_isin:184-246` + `procesar_fondo:448-470`. Caveat: depende de sonda HTTP que puede caer a fallback |
| M8-5 | 8 may | Lectura Renta Fija (duración, vencimiento, rating, cupón, precio, rendimiento) | ✅ | `procesar_fondo:558-566` (7 campos RF) |
| M8-6 | 8 may | Bug `TopB`=`TopE` en fondos RF | ✅ | Fix en `procesar_fondo:411-418` (separa `equityHoldingPage`/`boldHoldingPage`) + asserts 648-673 |
| M8-7 | 28 abr/8 may | Inputs RV adicionales (P/Bº, P/VC, P/Ventas, P/CF, div %, crecimientos) | ✅ | `procesar_fondo:545-556` |
| R21-1 | 21 may | Explicar caída tiempo 2h30→1h | ✅ | Respondido 22 may (reuso de sesión anti-bot, mismos 454 fondos) |
| R21-2 | 21 may | Resumen Claude confuso / cifras | ✅ | Aclarado 22 may (94,5% bruto vs 96,7% tras limpieza) |
| R21-3 | 21 may | Reclasificación `_status` DENTRO del pipeline, no script aparte | ✅ | Nuevo `clasificacion.py` (`clasificar_fondo`) llamado desde `procesar_fondo`. `clean_v6.py` reducido a cosmético. Paridad 0 mismatches vs v6_clean (`verify_clasificacion_paridad.py`). Pendiente commit |
| R21-4 | 21 may | Validación general v6 | ✅ | Edgard: CORRECTO |
| R21-5 | 21 may | 13 `DATOS_VACIOS` recuperados | ✅ | Edgard: CORRECTO (ver M8-1) |
| R21-6 | 21 may | 11 `NO_ENCONTRADO` justificados | ✅ | Edgard: CORRECTO |
| R21-7 | 21 may | 3ª pasada para 2 ISINs (LU1883854199, LU1883314244) | 🟡 | Mecanismo listo: `retry_regressions.py` los detecta automáticamente (ver R21-9) y los persistentes van a `regresiones_persistentes.txt` (no se pierden). El OK final depende de una corrida live. Pendiente commit |
| R21-8 | 21 may | Nota Warning en `xray_nota` para los `PARTIAL` | ✅ | `clasificacion.py`: todo PARTIAL recibe `xray_nota` con el detalle de `_errors`. Verificado (2/2 PARTIAL con nota). Pendiente commit |
| R21-9 | 21 may | Reintentar fondos que el mes anterior eran `OK` y cambian | ✅ | Nuevo `detectar_regresiones.py` (comparación automática mes-a-mes) cableado en `retry_regressions.py` (sustituye lista hardcodeada). Verificado v5→v6: 12 regresiones detectadas. Pendiente commit |
| R21-10 | 21 may | `_status` + `xray_disponible` + `xray_nota` desde una única función coherente | ✅ | Todo se decide en `clasificacion.clasificar_fondo` (una función). Pendiente commit |
| R21-11 | 21 may | X-Ray: no descartar ISINs + WARNINGs al principio | 🔜 | No implementado en UI. `XRayTab.tsx` sin bloque de avisos; spec lo marca como fase F5 |
| R21-12 | 21 may | 2 bugs `ISIN_match` (LU0076315455, LU2694991766) | 🔴 | Diagnosticado con datos v6: LU0076315455 → el probe extrajo `LU0173920264` del body (no el canónico) → falso MISMATCH; LU2694991766 → probe dio 404 pese a existir (header real LU1756522998). Ambos dependen del HTML real de Morningstar → fix + verificación requieren corrida live (no reproducible en sandbox sin red/mstarpy) |
| R21-13 | 21 may | `ISIN_es_aproximacion`=SI → nota Warning en `xray_nota` | ✅ | `clasificacion.py` añade aviso de aproximación (con ISIN header). Verificado (16/16 aproximaciones con aviso). Pendiente commit |
| R21-14 | 21 may | Integrar Universo en plataforma para X-Ray de clientes reales | 🔜 | `XRayTab.tsx:6-8` declara PLACEHOLDER hardcoded; sin queries a Supabase ni al Universo |
| R29-1 | 29 may | Campos de rentabilidad de los últimos 10 años (por año) en el Universo | 🔴 | Solo agregados trailing (`mapeo_periodos:600-608`). No hay rentabilidad por año natural |
| R29-2 | 29 may | 2ª página X-Ray Morningstar (rent. histórica) | 🔜 | No existe ruta/componente histórico. Depende de R29-1 |
| R29-3 | 29 may | X-Ray por cliente (cartera real), no genérico | 🔜 | = R21-14. `ClientDashboard.tsx:1588` usa `<XRayTab />` sin props; mismo render para todos |
| R29-4 | 29 may | POSICIONES antes del X-Ray | ✅ | Commit `bdeec67` (dashboard): Posiciones = sección 4, X-Ray = sección 5. Pushed a main, validate-aurum077 9/9 OK |

---

## Lectura del estado (honesta)

- **Captura de datos del Universo (8 may): cerrado, 6/6 en el flujo principal.**
- **Reglas de proceso/clasificación del v6 (21 may): mayormente cerradas (29 may).** Clasificación unificada dentro del pipeline (R21-3, R21-8, R21-10, R21-13 ✅, paridad verificada) y detección automática de regresiones mes-a-mes (R21-9 ✅). Queda abierto R21-12 (los 2 bugs de `ISIN_match` dependen del HTML real de Morningstar → fix + verificación en corrida live) y R21-7 a falta de confirmación en corrida live.
- **X-Ray (29 may): placeholder + reorden hecho.** R29-4 (Posiciones antes del X-Ray) ✅. El resto (R21-11, R21-14, R29-1, R29-2, R29-3) sigue pendiente: el X-Ray no refleja todavía cartera real ni rentabilidad histórica.

**Nota de método:** lo que toca lógica de datos pura se ha implementado y **verificado offline** (paridad de clasificación, detección de regresiones). Lo que depende de scraping live de Morningstar (R21-12, confirmación de R21-7, y la futura R29-1) requiere una corrida real en la máquina de Xabier; no se ha tocado código de scraping a ciegas.
