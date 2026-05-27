# MVP6 v2 — Audit Fixes Changelog

**Fecha:** 17 abril 2026
**Rama:** `feature/mvp6-v2-audit-fixes`
**Base:** `main` @ `6787172` (tag `pre-mvp6-v2`)
**Commits:** 2
**Archivos modificados:** 11 (+2.472 / -159 lineas)

---

## Resumen ejecutivo

Se realizo una auditoria completa de las 11 tareas del spec MVP6
(`docs/specs/MVP6_SPEC.md`) contra el codigo existente. Se identificaron
9 gaps y se corrigieron todos. Se anadio infraestructura de testing
(Vitest) con 18 tests y se paso revision OWASP sobre los cambios.

---

## Cambios por tarea

### T1 — Taxonomia de aportaciones

**Archivo:** `lib/operations-taxonomy.ts`

| Antes | Despues |
|---|---|
| 20 tipos NEUTRO explicitos | 21 tipos NEUTRO explicitos |

- Anadido `BAJA IIC SWITCH` al set `NEUTRO_TYPES` (contraparte de
  `ALTA IIC SWITCH` que ya existia).
- Impacto funcional: ninguno (el fallback en `classifyFlow()` ya
  trataba tipos desconocidos como neutro). Mejora la documentacion
  explicita y previene drift futuro.

---

### T6 — Eje temporal continuo

**Archivo:** `components/dashboard/CombinedChart.tsx` (reescritura completa)

| Antes | Despues |
|---|---|
| Eje X categorico (`dataKey="label"`) | Eje X numerico (`type="number"`, `scale="time"`) |
| Snapshots equiespaciados | Spacing proporcional a distancia temporal |
| Marcadores PLUS/MINUS en snapshot mas cercano | Marcadores en fecha exacta de operacion |
| Tooltip generico | Tooltip con tipo, importe, ISIN, producto |
| Linea `monotone` (interpolada) | Linea `stepAfter` (plana entre flujos) |

**Detalle tecnico:**
- Cada snapshot tiene un campo `ts` (timestamp numerico) que el eje X
  usa para posicionar proporcionalmente.
- Los flow events se inyectan como puntos sinteticos (`synthetic: true`)
  en su fecha exacta. Tienen marcadores PLUS/MINUS pero no tienen NAV
  bars (evita huecos visuales).
- El tooltip detecta `flowMeta` en el payload y muestra informacion
  detallada del movimiento.

---

### T7 — Zoom temporal

**Archivo:** `components/dashboard/CombinedChart.tsx`

| Antes | Despues |
|---|---|
| Sin controles de granularidad | Botones +/- con 4 niveles |

- 4 granularidades: **semanal** (defecto) > **mensual** > **trimestral** > **anual**.
- Boton `+` (mas detalle) y `-` (menos detalle) en esquina superior
  derecha del grafico, junto a los tabs de vista.
- Rollup: para granularidades superiores a semanal, se conserva el
  ultimo snapshot de cada bucket (mes/trimestre/ano).
- Los marcadores de aportaciones **siempre** aparecen en fecha exacta,
  independientemente de la granularidad.
- Cambio es 100% client-side, sin recarga.

---

### T8 — Fix "Desde origen"

**Archivo:** `app/api/dashboard/route.ts`

| Antes | Despues |
|---|---|
| API devuelve 25 ops paginadas | API devuelve TODAS las ops |
| `originDate` calculado sobre 25 ops | `originDate` calculado sobre historico completo |
| Flujos y FIFO rotos en re-fetch | Flujos y FIFO correctos siempre |

**Causa raiz:** La pagina servidor (`page.tsx`) ya pasaba todas las ops
via `getAllOperationsForAccounts`, pero la ruta API (`/api/dashboard`)
usaba `getOperations` paginado (25/pagina). Cuando el usuario cambiaba
de cuenta o rango de fechas client-side, `fetchData()` llamaba a la API
y recibia solo 25 ops, rompiendo:
- `originDate` (primera operacion)
- `netContributions` (aportaciones netas)
- `flowEvents` (marcadores del grafico)
- `productTypeMap` (clasificacion IIC/RV)

**Fix:** La API ahora usa `getAllOperationsForAccounts` (con cache 5min).
La paginacion de la tabla de operaciones se hace client-side.

---

### T10B — Reorden del dashboard

**Archivo:** `components/dashboard/ClientDashboard.tsx`

| Antes (orden) | Despues (orden) |
|---|---|
| 1. KPIs | 1. KPIs |
| 2. PositionsTable | 2. Evolucion Patrimonial (grafico) |
| 3. Distribucion de Activos | 3. Distribucion de Activos |
| 4. Evolucion Patrimonial | 4. Posiciones (colapsable) |
| 5. Cartera / Operaciones | 5. Cartera / Operaciones |
| 6. Espacio Personal | 6. Espacio Personal |

- La tabla de posiciones ahora es **colapsable** con un boton
  toggle. **Colapsada por defecto** al abrir el dashboard.
- Nuevo state: `positionsOpen` (default `false`).

---

### T10D — Distribucion de activos

**Archivo:** `components/dashboard/ClientDashboard.tsx` (funcion `AssetDistribution`)

| Antes | Despues |
|---|---|
| Donut 1: por Gestora | Donut 1: por Tipo de Activo |
| Donut 2: por Moneda | Donut 2: por Moneda (sin cambios) |

- Categorias: **Fondos (IIC)**, **Acciones / ETFs (RV)**, **Efectivo**.
- Usa `resolveProductType()` + `productTypeMap` (fuente fiable: tipo
  de la primera compra en operaciones).
- Incluye `cashBalance` en el total y en el donut.

---

### T11 — Idle logout

**Archivo:** `components/auth/IdleLogoutWatcher.tsx`

| Antes | Despues |
|---|---|
| 10 min timeout | 30 min timeout (hypercare) |
| 1 min warning | 2 min warning |
| Toast pequeno esquina inferior | Modal centrado con overlay |
| Solo boton "Seguir" | Botones "Si, seguir" + "Cerrar sesion" |

- Constantes renombradas: `IDLE_MS` = 30min, `WARNING_MS` = 2min.
- Comentario indica cambiar a 20min para release.
- Modal centrado con backdrop semi-transparente para mayor visibilidad.
- Boton "Cerrar sesion" llama a `doLogout()` inmediatamente.

---

### T5 — Tests

**Archivos nuevos:**
- `vitest.config.ts`
- `lib/__tests__/eur-cost-fifo.test.ts` (8 tests)
- `lib/__tests__/operations-taxonomy.test.ts` (10 tests)

**Dependencia nueva:** `vitest` (devDependency)

**Tests FIFO (3 escenarios del spec + extras):**

| Test | Descripcion |
|---|---|
| (a) Single buy, no sell | Lote completo permanece |
| (b) Multiple buys + partial sell | FIFO consume del lote mas antiguo |
| (c) Sells consuming multiple lots | Cadena FIFO cruza multiples lotes |
| Fully sold excluded | Posicion vendida no aparece en resultado |
| NEUTRO ignored | Splits no afectan lotes |
| Chronological sort | Orden de input no afecta resultado |
| eurCostForPosition null | ISIN desconocido devuelve null |
| eurCostForPosition scale | Escala proporcional si unidades difieren |

**Tests Taxonomia:**

| Test | Descripcion |
|---|---|
| 5 PLUS types | Todos clasifican como "plus" |
| 6 MINUS types | Todos clasifican como "minus" |
| 11 NEUTRO types | Todos clasifican como "neutro" |
| Unknown = neutro | Tipos no listados caen a neutro |
| Case insensitive | Minusculas funcionan |
| Count 22 total | 5+6+11 tipos explicitos |
| PLUS flow amount | Devuelve eur_amount positivo |
| MINUS flow amount | Devuelve -(gross * fx) negativo |
| MINUS fallback | Sin gross_amount usa eur_amount |
| NEUTRO flow = 0 | Siempre devuelve 0 |

---

### Security — Validacion UUID

**Archivo:** `app/api/dashboard/route.ts`

| Antes | Despues |
|---|---|
| `accountId` aceptado sin validar | Regex UUID v4 obligatorio |
| `accounts` JSON sin validar tipo | Validado: array de strings UUID |

- Regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- Defensa en profundidad: RLS ya protege, pero validar input es buena practica.

---

## Revision OWASP

| Categoria | Resultado |
|---|---|
| A01 Broken Access Control | PASS — RLS en todas las tablas |
| A02 Security Misconfiguration | PASS — anon key, no service_role |
| A05 Injection | FIXED — UUID validation anadida |
| A06 Insecure Design | PASS — timeouts apropiados |
| A07 Auth Failures | PASS — session invalidation correcta |
| A09 Logging Failures | PASS — Sentry captura errores |
| A10 Exception Handling | PASS — fail-closed, sin stack traces |

---

## Pendiente (no tocado en este PR)

- **T9 parcial:** Client list en admin no paginada (es un dropdown con search, no tabla — aceptable para 159 clientes).
- **`getAllOperationsForAccounts` return type `any[]`:** Deberia tiparse como `Operation[]` en un cleanup futuro.
- **Validacion Aurum-077 en vivo:** Los numeros de referencia (290.922,76 y 301.070,18) deben verificarse ejecutando `scripts/validate-aurum077.mjs` contra la BD de produccion antes de merge.

---

## Como verificar

```bash
# Type check
npx tsc --noEmit

# Tests (18/18)
npx vitest run

# Build
npm run build

# Validacion numerica (requiere conexion a Supabase)
node scripts/validate-aurum077.mjs
```
