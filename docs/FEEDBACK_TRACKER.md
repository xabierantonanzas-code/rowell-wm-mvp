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
| R21-3 | 21 may | Reclasificación `_status` DENTRO del pipeline, no script aparte | 🔴 | **`clean_v6.py:42-71` sigue siendo script separado, ejecutado a mano. El pipeline NO lo invoca** |
| R21-4 | 21 may | Validación general v6 | ✅ | Edgard: CORRECTO |
| R21-5 | 21 may | 13 `DATOS_VACIOS` recuperados | ✅ | Edgard: CORRECTO (ver M8-1) |
| R21-6 | 21 may | 11 `NO_ENCONTRADO` justificados | ✅ | Edgard: CORRECTO |
| R21-7 | 21 may | 3ª pasada para 2 ISINs (LU1883854199, LU1883314244) | 🟡 | `retry_regressions.py` los reprocesa, pero es **script separado** (no 3ª pasada integrada) y el OK no está garantizado en código |
| R21-8 | 21 may | Nota Warning en `xray_nota` para los `PARTIAL` | 🟡 | `procesar_fondo:707-710` solo pone nota si faltan pct_Equity/FixedIncome; los PARTIAL por WARN de holdings caen sin nota (712-713) |
| R21-9 | 21 may | Reintentar fondos que el mes anterior eran `OK` y cambian | 🔴 | **No hay comparación contra el Excel del mes anterior** (grep mes_anterior/prev_month = 0). `retry_regressions.py` usa lista hardcodeada |
| R21-10 | 21 may | `_status` + `xray_disponible` + `xray_nota` desde una única función coherente | 🟡 | Se calculan en bloques separados (`:675-688` y `:690-713`) + la reclasificación final en `clean_v6.py` (3er sitio) |
| R21-11 | 21 may | X-Ray: no descartar ISINs + WARNINGs al principio | 🔜 | No implementado en UI. `XRayTab.tsx` sin bloque de avisos; spec lo marca como fase F5 |
| R21-12 | 21 may | 2 bugs `ISIN_match` (LU0076315455, LU2694991766) | 🔴 | **Ninguno de los 2 ISINs aparece en el repo** (grep = 0). Sin fix ni test |
| R21-13 | 21 may | `ISIN_es_aproximacion`=SI → nota Warning en `xray_nota` | 🔴 | El bloque xray (`:690-713`) no consulta `ISIN_es_aproximacion` |
| R21-14 | 21 may | Integrar Universo en plataforma para X-Ray de clientes reales | 🔜 | `XRayTab.tsx:6-8` declara PLACEHOLDER hardcoded; sin queries a Supabase ni al Universo |
| R29-1 | 29 may | Campos de rentabilidad de los últimos 10 años (por año) en el Universo | 🔴 | Solo agregados trailing (`mapeo_periodos:600-608`). No hay rentabilidad por año natural |
| R29-2 | 29 may | 2ª página X-Ray Morningstar (rent. histórica) | 🔜 | No existe ruta/componente histórico. Depende de R29-1 |
| R29-3 | 29 may | X-Ray por cliente (cartera real), no genérico | 🔜 | = R21-14. `ClientDashboard.tsx:1588` usa `<XRayTab />` sin props; mismo render para todos |
| R29-4 | 29 may | POSICIONES antes del X-Ray | ✅ | Hecho 29 may: `ClientDashboard.tsx` reordenado → Posiciones = sección 4, X-Ray = sección 5. Typecheck sin errores nuevos. Pendiente commit |

---

## Lectura del estado (honesta)

- **Captura de datos del Universo (8 may): cerrado, 6/6 en el flujo principal.** Es el bloque más sólido. Lo que Edgard validó como CORRECTO está realmente en el código.
- **Reglas de proceso/clasificación del v6 (21 may): mayormente abiertas.** El punto de fondo (R21-3: la reclasificación tiene que vivir dentro del pipeline) **sigue en un script aparte**. No hay comparación mes-a-mes (R21-9), los 2 bugs de `ISIN_match` (R21-12) no se han tocado, y las notas de aviso (R21-8, R21-13) están a medias o sin hacer.
- **X-Ray (29 may): placeholder.** Hoy es una maqueta visual con datos hardcoded del PDF de ejemplo, igual para todos los clientes. Esto es **por secuencia** (se pidió OK al *shape* antes de cablear datos reales), no descuido — pero conviene decirlo claro: nada del X-Ray refleja todavía cartera real ni rentabilidad histórica.

**Conclusión:** la percepción de Edgard tiene base real en el bloque de proceso (21 may): se respondió con compromisos pero varios puntos no se ejecutaron o quedaron fuera del flujo. La captura de datos sí está hecha. El X-Ray está pendiente por diseño.
