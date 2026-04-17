# Rowell Patrimonios — MVP6 Spec

**Fecha:** 17 abril 2026
**Autor:** Xabier (vía claude.ai, a partir de inputs de Edgard)
**Target:** Claude Code
**Repo:** `xabierantonanzas-code/rowell-wm-mvp` (privado)
**Producción:** https://rowell-dashboard.vercel.app
**Arranque:** `cd "$HOME/Desktop/Projects/rowell dashboard" && claude`

---

## 0. Cómo usar este documento

Este documento contiene **11 tareas** para MVP6, ordenadas por prioridad de ejecución. Cada tarea es autocontenida: objetivo, inputs, outputs, lógica, archivos a tocar, criterios de aceptación, fuera de alcance.

**Reglas de ejecución:**
1. Las tareas marcadas `[BLOQUEANTE]` bloquean las siguientes hasta que estén completas y validadas.
2. Las tareas marcadas `[INDEPENDIENTE]` se pueden hacer en cualquier orden.
3. Antes de dar una tarea por cerrada, validar todos los criterios de aceptación listados.
4. Si hay ambigüedad, **parar y preguntar** — no inventar lógica que "cuadre".
5. Nunca tocar archivos fuera del alcance declarado en cada tarea.

**Validación dorada:** cliente `Aurum-077`. Aportaciones netas esperadas = **290.922,76 €**. Este número se usa como test de aceptación en varias tareas.

**Pendiente de Edgard (no bloquea todo, pero sí los cálculos):** modelo matemático de las 4 rentabilidades (Acumulada, Acumulada en posiciones actuales, MWR, TWR) con ejemplos numéricos de clientes. Hasta que llegue, **no se toca la lógica de TWR/MWR** más allá de lo indicado en tarea 9.

---

## Orden de ejecución recomendado

| # | Tarea | Tipo | Depende de |
|---|-------|------|---|
| 1 | Taxonomía de aportaciones | BLOQUEANTE | — |
| 2 | Fecha real de flujos (no snapshot) | BLOQUEANTE | 1 |
| 3 | Soporte múltiples snapshots por semana | BLOQUEANTE | — |
| 4 | Divisa en posiciones | INDEPENDIENTE | — |
| 5 | Efecto divisa real + FIFO (P&L con FX) | BLOQUEANTE | 1, 2 |
| 6 | Eje temporal continuo en gráfico combinado | INDEPENDIENTE | 2 |
| 7 | Zoom temporal (semanal/mensual/trimestral/anual) | INDEPENDIENTE | 6 |
| 8 | Fix botón "Desde origen" por cartera | INDEPENDIENTE | — |
| 9 | Materialized view + paginación | INDEPENDIENTE | 1, 2, 3 |
| 10 | Rebrand colores + reorden dashboard + tabla posiciones | INDEPENDIENTE | 4 |
| 11 | Logout idle con warning | INDEPENDIENTE | — |

---

## Tarea 1 — Taxonomía de aportaciones [BLOQUEANTE]

### Contexto
El sistema actualmente no interpreta bien las operaciones del Registro de Operaciones y las aportaciones no aparecen o son incorrectas. Esto rompe todo el cálculo de flujos del cliente.

### Objetivo
Clasificar cada fila del Registro de Operaciones en una de tres categorías (PLUS / MINUS / NEUTRO) según su `TIPO DE OPERACIÓN`, y calcular el importe del flujo correctamente según la categoría.

### Inputs
Archivo Mapfre de Registro de Operaciones (uploaded por Edgard cada viernes). Estructura:
- `skiprows=2` (fila 1 = título, fila 2 = metadata, fila 3 = headers)
- Columnas relevantes:
  - `col[14]` = `FECHA DE CONTRATACION` (fecha real del flujo)
  - `col[21]` = `EFECTIVO BRUTO`
  - `col[23]` = `CAMBIO DE DIVISA`
  - `col[24]` = `CONTRAVALOR EFECTIVO NETO`
  - Columna con `TIPO DE OPERACION` (confirmar índice contra archivo real antes de codear)

### Lógica

**Clasificación por tipo de operación:**

```
PLUS (entrada de capital a la cartera):
  - SUSCRIPCIÓN FONDOS INVERSIÓN
  - COMPRA RV CONTADO
  - COMPRA SICAVS
  - RECEPCION INTERNA IIC LP
  - SUSC.TRASPASO EXT.

MINUS (salida de capital de la cartera):
  - VENTA RV CONTADO
  - LIQUIDACION IICS
  - TRASPASO INTERNO IIC LP
  - REEMBOLSO FONDO INVERSIÓN
  - REEMBOLSO OBLIGATORIO IIC
  - REEMBOLSO POR TRASPASO EXT.

NEUTRO (ignorar para cálculo de aportaciones):
  - AJUSTE PARTICIP SUSCRITAS
  - ALTA DE NUEVO VALOR POR SPLIT
  - BAJA SPLIT/CONTRASPLIT IICS
  - ALTA IIC SWITCH
  - BAJA IIC SWITCH (aparece solo en "Movimientos CV", no en Registro de Operaciones)
  - ALTA SPLIT/CONTRASPLIT IICS
  - BAJA DE VALOR POR SPLIT
  - SUSCRIPCION POR FUSION
  - REEMBOLSO POR FUSION
  - SUSC.TRASPASO. INT.
  - REEMBOLSO POR TRASPASO INT.
```

**Cálculo del importe:**

- **PLUS**: `importe = CONTRAVALOR EFECTIVO NETO` (col[24]). La comisión de compra ya está incluida en el precio y se refleja en `COSTE MEDIO POSICION`, por lo que la rentabilidad neta se mantiene coherente.
- **MINUS**: `importe = EFECTIVO BRUTO × CAMBIO DE DIVISA` (col[21] × col[23]). Nota: el cliente recibe `CONTRAVALOR EFECTIVO NETO` en euros, pero el valor vendido de cartera es el bruto × cambio. La diferencia son comisiones/retenciones.
- **NEUTRO**: se ignora completamente, no se suma ni se resta.

**Aportación neta acumulada a fecha T:**
```
aportacion_neta(T) = Σ PLUS(fecha ≤ T) - Σ MINUS(fecha ≤ T)
```

### Archivos a tocar
- `lib/parsers/operations.ts` (o equivalente — parser del Registro de Operaciones)
- `lib/queries/operations.ts` (queries que consumen esos datos)
- Posibles llamadores en `app/api/upload/route.ts` y componentes de dashboard

### Criterios de aceptación
- [ ] Test unitario del parser clasifica correctamente las 21 tipologías listadas.
- [ ] Cliente `Aurum-077`: aportaciones netas acumuladas = **290.922,76 €** (a fecha de corte del último dato disponible, probablemente marzo 2026).
- [ ] Operaciones NEUTRO no aparecen en la suma de flujos bajo ningún concepto.
- [ ] El signo MINUS se resta (no se suma con valor negativo si los datos Mapfre ya vienen con signo).

### Fuera de alcance
- No tocar `positions`, `cash_balances` o cálculo de NAV.
- No cambiar la taxonomía por intuición — si aparece un tipo de operación no listado arriba, **parar y preguntar**.

---

## Tarea 2 — Fecha real de flujos [BLOQUEANTE]

### Contexto
Actualmente las aportaciones se pintan en el gráfico en la fecha del snapshot de posición (fin de mes o fecha de consulta), no en la fecha real en que ocurrió el flujo. Esto distorsiona el TWR, el MWR, y la visualización.

### Objetivo
Usar `FECHA DE CONTRATACION` (col[14] del Registro de Operaciones) como timestamp canónico de cada flujo PLUS/MINUS.

### Lógica
- Cada fila PLUS/MINUS tiene su fecha propia (`FECHA DE CONTRATACION`).
- Las aportaciones pueden ocurrir cualquier día operativo (lunes-viernes), no coinciden necesariamente con snapshots de posición.
- Los snapshots de posición/saldo existen solo en días de consulta (por ahora semanales, viernes).
- **No hay que alinear** flujos con snapshots. Son dos escalas temporales distintas.

### Archivos a tocar
- `lib/queries/operations.ts`
- Componentes del dashboard que leen fechas de aportaciones (especialmente `DashboardFilters.tsx` y el gráfico combinado)

### Criterios de aceptación
- [ ] Cliente `Aurum-077`: la operación de suscripción `#6988038` aparece exactamente el **10 de febrero de 2026** (no a fin de mes).
- [ ] Ninguna aportación aparece en fecha de snapshot si no coincide con su `FECHA DE CONTRATACION`.
- [ ] Query de aportaciones devuelve la fecha real, no la más cercana.

### Fuera de alcance
- No tocar todavía cómo se visualiza (eso es tarea 6).

---

## Tarea 3 — Soporte múltiples snapshots por semana [BLOQUEANTE]

### Contexto
El sistema actualmente asume un snapshot mensual de posiciones. Edgard va a empezar a subir 5 archivos `_Pos.xlsx` + 5 `_Saldo.xlsx` cada viernes (lunes a viernes de esa semana), más 1 Registro de Operaciones semanal. El sistema tiene que soportar múltiples fechas de snapshot dentro del mismo mes y semana.

### Objetivo
Hacer que todas las queries y lógicas que usan `positions.fecha_snapshot` funcionen correctamente con granularidad diaria, no mensual.

### Lógica
- Cualquier query que use `SELECT MAX(fecha_snapshot) FROM positions` tiene que considerar el ámbito (cliente, cuenta, fecha de corte).
- Para cálculos de TWR, el NAV del día del flujo debe ser el snapshot **del mismo día si existe**, o el más cercano anterior si no existe.
- El upload debe detectar automáticamente las fechas incluidas en cada archivo Excel y no sobrescribir datos existentes de otras fechas.

### Archivos a tocar
- `lib/queries/positions.ts`
- `lib/queries/clients.ts` (si computa "valor cartera" con `MAX(fecha)`)
- `app/api/upload/route.ts`
- Cualquier componente que pida "última posición"

### Criterios de aceptación
- [ ] Subir 5 snapshots de la misma semana (lun-vie) no sobrescribe datos ni duplica filas. Cada snapshot se guarda con su fecha.
- [ ] Query "última posición del cliente X" devuelve el snapshot más reciente que tenga datos para alguna de sus cuentas.
- [ ] Si un cliente no tiene posición el día D pero sí el día D-1, las queries que pidan NAV del día D devuelven el de D-1 (último disponible anterior).
- [ ] El gráfico combinado pinta un punto por snapshot disponible, no solo uno al mes.

### Fuera de alcance
- No afecta al parser ni a `operations`.
- No afecta todavía a la materialized view (eso es tarea 9).

---

## Tarea 4 — Divisa en posiciones [INDEPENDIENTE]

### Contexto
`COSTE MEDIO POSICIÓN` (col[10]) y `PRECIO MERCADO` (col[11]) están en divisa original del activo (USD, CHF, EUR…). Actualmente la UI los muestra sin divisa, lo que puede inducir a error al cliente. `POSICION` (col[12]) siempre es EUR, no cambia.

### Objetivo
Leer la divisa de `col[6]` en el archivo `_Pos.xlsx` y mostrarla junto al valor de COSTE y PRECIO.

### Archivos a tocar
- `lib/parsers/positions.ts` (añadir campo `currency` si no existe)
- Schema Supabase `positions` (verificar si `currency` existe; si no, ADD COLUMN)
- Componente de tabla de posiciones

### Criterios de aceptación
- [ ] Tabla de posiciones muestra divisa junto a COSTE y PRECIO (ej: `182,45 USD`, `198,10 USD`).
- [ ] `POSICION` sigue mostrándose solo en EUR (sin divisa sufijo adicional, porque ya está convertido).
- [ ] Las 28 posiciones USD conocidas (Microsoft, Tesla, Amazon, Alphabet, Apple…) se muestran correctamente con USD.
- [ ] Las 841 posiciones EUR no muestran un sufijo incorrecto.

### Fuera de alcance
- No cambiar cómo se suman los totales (POSICION ya viene en EUR).
- El P&L con FX es tarea 5.

---

## Tarea 5 — Efecto divisa real + FIFO [BLOQUEANTE, antes MVP7]

### Contexto
**Esta tarea se ha adelantado de MVP7 a MVP6 por decisión de Xabier.** La rentabilidad acumulada actual no tiene en cuenta el efecto de la divisa: compara `PRECIO - COSTE` en divisa original, lo que ignora que un movimiento del EUR/USD cambia el valor real en euros del inversor.

Ejemplo: comprar 100 Microsoft a 150 USD con EUR/USD = 1,10 → coste real 13.636 €. Si hoy Microsoft está a 200 USD pero EUR/USD = 1,20 → valor = 16.667 €. Rentabilidad sin FX: +33%. Rentabilidad con FX: +22%. Son números distintos.

### Objetivo
Calcular la rentabilidad acumulada de las posiciones **actualmente en cartera** teniendo en cuenta:
1. El coste real en EUR en el momento de cada compra.
2. Lógica FIFO sobre el Registro de Operaciones para saber qué lote de compra sigue vivo.
3. El tipo de cambio vigente en cada fecha de compra.

Resultado esperado para `Aurum-077`: **301.070,18 €** de rentabilidad acumulada con efecto divisa (el valor incorrecto sin FX es el que sale ahora en rojo en la UI).

### Lógica

**Paso 1 — Guardar FX rate de compra:**
- En el Registro de Operaciones, cada compra (PLUS) tiene su `CAMBIO DE DIVISA` (col[23]).
- Añadir campo `purchase_eur_cost` a la tabla `operations` o crear tabla auxiliar `operation_lots` con:
  - `operation_id`
  - `quantity`
  - `eur_cost_per_unit`
  - `remaining_quantity` (para FIFO)

**Paso 2 — FIFO sobre ventas:**
- Cuando hay una venta (MINUS), consumir del lote más antiguo primero.
- Decrementar `remaining_quantity` de los lotes conforme se venden.

**Paso 3 — Cálculo de rentabilidad acumulada con FX:**
Para cada posición actual (ISIN + cuenta):
```
eur_cost_lote_vivo = Σ (lote.remaining_quantity × lote.eur_cost_per_unit)
                     para todos los lotes con remaining_quantity > 0

eur_valor_hoy = POSICION (col[12], ya viene en EUR)

rentabilidad_acumulada_eur = eur_valor_hoy - eur_cost_lote_vivo
rentabilidad_acumulada_pct = rentabilidad_acumulada_eur / eur_cost_lote_vivo
```

**Paso 4 — Rentabilidad sin FX (ya existente, conservar):**
Comparar `PRECIO` y `COSTE MEDIO POSICIÓN` en divisa original.

**Paso 5 — Efecto divisa = diferencia:**
```
efecto_divisa = rentabilidad_con_fx - rentabilidad_sin_fx
```

### Archivos a tocar
- Migración Supabase: añadir columnas o tabla `operation_lots`
- `lib/parsers/operations.ts` (guardar `CAMBIO DE DIVISA` al importar)
- `lib/queries/positions.ts` o nuevo `lib/queries/returns.ts` (lógica FIFO)
- Tabla de posiciones (UI)
- KPIs del dashboard (si muestran rentabilidad acumulada)

### Criterios de aceptación
- [ ] Cliente `Aurum-077`: rentabilidad acumulada con FX = **301.070,18 €** (o el número exacto que confirme Edgard).
- [ ] Tabla de posiciones muestra dos columnas P&L: uno sin efecto divisa (%, en divisa base) y uno con efecto divisa (€, EUR).
- [ ] FIFO consume lotes en orden cronológico estricto (fecha de `FECHA DE CONTRATACION`).
- [ ] Las posiciones totalmente vendidas (sum remaining = 0) no contribuyen a rentabilidad acumulada actual.
- [ ] Tests unitarios con 3 escenarios: (a) una sola compra sin venta, (b) múltiples compras + una venta parcial, (c) ventas que consumen múltiples lotes.

### Fuera de alcance
- Rentabilidad acumulada histórica total (incluyendo posiciones ya cerradas) — es otra métrica, queda para después.
- TWR y MWR no se tocan aquí, esperan al input de Edgard (punto 16 del documento de Edgard).

### Riesgo técnico
Esta tarea es la más delicada del MVP6. **Trabajar en una rama separada** (`feature/fx-returns`) y no hacer merge hasta validar con Edgard el número final para `Aurum-077`.

---

## Tarea 6 — Eje temporal continuo [INDEPENDIENTE, depende de 2]

### Contexto
El gráfico combinado NAV + Rentabilidad + Aportaciones actualmente tiene eje X **categórico** (cada snapshot ocupa el mismo ancho). Esto hace que el 30 de enero, el 10 de febrero y el 28 de febrero aparezcan equiespaciados, cuando temporalmente son muy distintos. Además las aportaciones se pintan en fechas de snapshot, no reales.

### Objetivo
Convertir el eje X a **fecha real continua** y desacoplar los flujos de los snapshots.

### Lógica

**Eje X:**
- Tipo fecha (no categórico), escala proporcional.
- Formato tick: `DD MMM YY` (ej: `10 feb 26`).

**Series a pintar:**
1. **NAV** (barras apiladas): en cada fecha de snapshot, barra apilada con 3 categorías:
   - Abajo: efectivo (de `cash_balances`)
   - Medio: fondos de inversión (IIC, `positions` filtrado por tipo fondo)
   - Arriba: RV (acciones/ETFs, `positions` filtrado por tipo RV)
   - La barra está **centrada con el punto de la línea de rentabilidad** en la misma fecha.

2. **Rentabilidad** (línea): punto en cada fecha de snapshot.

3. **Aportaciones netas acumuladas** (línea continua): calculada en cada fecha que haya un PLUS o un MINUS. Entre flujos, la línea se mantiene plana en el último valor acumulado.
   - Marcador ● **verde** en fecha exacta de cada PLUS.
   - Marcador ● **rojo** en fecha exacta de cada MINUS.
   - Tooltip sobre el marcador: fecha, tipo, importe, ISIN/concepto si aplica.

### Archivos a tocar
- `components/charts/CombinedChart.tsx` (o equivalente)
- Query que alimenta el gráfico (consolidar snapshots + flujos)

### Criterios de aceptación
- [ ] Cliente `Aurum-077`: el marcador de la operación #6988038 aparece exactamente en **10 de febrero 2026** (verde, si es PLUS).
- [ ] Dos snapshots separados por 4 días en el eje X ocupan menos ancho que dos separados por 30 días.
- [ ] La línea de aportaciones netas no cae a cero entre flujos — se mantiene plana.
- [ ] Las barras NAV están apiladas y centradas con el punto de rentabilidad de la misma fecha.
- [ ] Eje X muestra día, mes y año (`10 feb 26`), no solo mes-año.

### Fuera de alcance
- Zoom dinámico (es tarea 7).

---

## Tarea 7 — Zoom temporal dinámico [INDEPENDIENTE, depende de 6]

### Contexto
Con datos semanales, un cliente con 2 años de historial tiene ~100 puntos. Para vistas largas, el usuario necesita agrupar.

### Objetivo
Botones `+` y `−` arriba a la derecha del gráfico combinado que cambien la granularidad entre: **semanal / mensual / trimestral / anual**.

### Lógica
- Granularidad por defecto: **semanal** (todos los snapshots disponibles).
- Botón `−` hace rollup: semanal → mensual → trimestral → anual.
- Botón `+` hace drill-down inverso.
- En mensual: un punto por mes, valor = último snapshot del mes.
- En trimestral: un punto por trimestre, valor = último snapshot del trimestre.
- En anual: un punto por año, valor = último snapshot del año.
- Los marcadores de aportaciones **se mantienen siempre en fecha exacta**, independientemente de la granularidad elegida.

### Archivos a tocar
- `components/charts/CombinedChart.tsx`
- Utilidad nueva `lib/utils/timeGranularity.ts`

### Criterios de aceptación
- [ ] Botones `+` y `−` visibles arriba a la derecha del gráfico, alineados con otros controles.
- [ ] Cambio de granularidad no recarga la página, es client-side.
- [ ] Las aportaciones (marcadores) mantienen fecha exacta siempre.
- [ ] Tooltip sigue funcionando en todas las granularidades.

### Fuera de alcance
- No cambiar layout del dashboard por este cambio.

---

## Tarea 8 — Fix botón "Desde origen" [INDEPENDIENTE]

### Contexto
El botón "Desde origen" actualmente selecciona la fecha de hoy + una fecha inicial que no corresponde al cliente real.

### Objetivo
"Desde origen" = fecha de la **primera operación registrada** en cualquiera de las CVs actualmente en visualización.

### Lógica
- Si el dashboard está mostrando todas las CVs del cliente: origen = `MIN(FECHA DE CONTRATACION)` entre todas las operaciones de todas sus CVs.
- Si el usuario ha filtrado a una CV concreta: origen = `MIN(FECHA DE CONTRATACION)` solo de las operaciones de esa CV.
- Fecha final = hoy.

### Archivos a tocar
- `components/DashboardFilters.tsx` (o equivalente)
- Query `lib/queries/operations.ts` (función `getFirstOperationDate(clientId, cvIds?)`)

### Criterios de aceptación
- [ ] Cliente con una sola CV: "Desde origen" = fecha primera operación de esa CV.
- [ ] Cliente con 3 CVs visualizando todas: "Desde origen" = fecha primera operación entre las 3.
- [ ] Mismo cliente filtrando a la CV más reciente: "Desde origen" cambia dinámicamente.
- [ ] No se queda la fecha de hoy como inicio.

---

## Tarea 9 — Materialized view + paginación [INDEPENDIENTE, depende de 1, 2, 3]

### Contexto
Tiempos de carga de la lista de clientes actual: 3-8s. Objetivo: < 300ms. Con datos diarios la carga va a empeorar.

### Objetivo
Precalcular en Supabase un resumen por cliente y refrescarlo al final de cada upload.

### Lógica

**Materialized view:**
```sql
CREATE MATERIALIZED VIEW client_summary AS
SELECT
  c.id AS client_id,
  c.alias, c.agent, c.auth_user_id,
  COUNT(DISTINCT a.id) AS num_cuentas,
  COALESCE(SUM(p.posicion), 0) AS valor_cartera,
  MAX(p.fecha_snapshot) AS ultima_fecha
FROM clients c
LEFT JOIN accounts a ON a.client_id = c.id AND a.is_active = TRUE
LEFT JOIN positions p ON p.account_id = a.id
  AND p.fecha_snapshot = (
    SELECT MAX(fecha_snapshot)
    FROM positions p2
    WHERE p2.account_id = a.id
  )
GROUP BY c.id, c.alias, c.agent, c.auth_user_id;

CREATE UNIQUE INDEX ON client_summary(client_id);
```

**Importante:** el `MAX(fecha_snapshot)` se calcula **por cuenta**, no global. Si un cliente no tiene snapshot en la última fecha global pero sí en una anterior, su `valor_cartera` debe reflejar el último dato disponible suyo.

**Función de refresh:**
```sql
CREATE OR REPLACE FUNCTION refresh_client_summary()
RETURNS void AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY client_summary;
$$ LANGUAGE sql SECURITY DEFINER;
```

`CONCURRENTLY` requiere el unique index y evita bloquear lecturas durante el refresh.

**Integración en upload:**
- Al final de `app/api/upload/route.ts`, después de insertar posiciones/saldos/operaciones, llamar a `refresh_client_summary()`.

**Paginación:**
- Lista de clientes en sección admin: paginación de **25 por página**.
- Usar `LIMIT` + `OFFSET` o cursor-based (preferido para tablas grandes).

### Archivos a tocar
- Nueva migración Supabase con la materialized view y la función
- `app/api/upload/route.ts` (llamar a `refresh_client_summary()` al final)
- `lib/queries/clients.ts` (leer de `client_summary` en lugar de calcular en vivo)
- Componente de lista de clientes (paginación)

### Criterios de aceptación
- [ ] Lista de clientes carga en < 300ms para 159 clientes.
- [ ] Después de un upload, `client_summary` refleja los nuevos datos.
- [ ] `REFRESH CONCURRENTLY` no bloquea lecturas concurrentes.
- [ ] Paginación funciona, botones prev/next visibles.
- [ ] Si un cliente no tiene snapshots, aparece con `valor_cartera = 0` y `num_cuentas = 0` o correcto según sus cuentas.

### Fuera de alcance
- Multi-tenancy (es MVP7).
- Otros precálculos (rentabilidad por cliente, etc.) — solo `valor_cartera` y `num_cuentas` por ahora.

---

## Tarea 10 — Rebrand + reorden dashboard + tabla posiciones [INDEPENDIENTE, depende de 4]

### Contexto
Actualización visual del dashboard cliente para alinearse con la nueva identidad Rowell y mejorar el orden de información.

### Objetivo
Tres cambios en paralelo sobre UI del dashboard cliente.

### 10A — Colores oficiales

Actualizar `tailwind.config.js` y `globals.css`:

```
primary:    #3D4F63   (reemplaza #0B1D3A)
gold:       #B8965A   (reemplaza #C9A84C)
background: #F5F5F5
text:       #1A1A1A
```

**Aplicar en:** sidebar, cards, botones, headers, gráficos.

**Restricción WCAG:** `#B8965A` sobre `#F5F5F5` da contrast ratio ~3.4:1, **no pasa AA para texto pequeño**. Usar gold solo para:
- Acentos grandes (headers ≥ 18px)
- Iconos
- Bordes
- Fondos de botón (texto sobre gold debe ser blanco o primary)

`#3D4F63` sobre `#F5F5F5` da ~7.8:1, OK.

### 10B — Reorden vertical del dashboard

Orden de arriba abajo:
1. **KPIs (tiles)** — valor cartera, rentabilidad, aportaciones netas.
2. **Gráficos** — combinado (NAV + rentabilidad + aportaciones), luego distribuciones (donuts por tipo de activo).
3. **Tabla de posiciones** (colapsable por defecto, se expande con click).

### 10C — Tabla de posiciones

- **Eliminar columna "Gestora"** (no es relevante).
- **Añadir divisa** junto a COSTE y PRECIO (ya cubierto por tarea 4).
- **Añadir P&L**:
  - P&L en EUR con efecto divisa (de tarea 5).
  - P&L en % sin efecto divisa (comparación directa PRECIO vs COSTE en divisa base).
- **Separar en 2 subsecciones**:
  - **IIC (fondos de inversión)**
  - **RV (acciones/ETFs)**
- **Colapsable**: botón para expandir/contraer toda la tabla.

### 10D — Distribuciones por tipo de activo

Sustituir (o añadir si no existe) donut con distribución por:
- Acciones (FI + RV)
- Obligaciones (RF)
- Efectivo
- Otro

**Eliminar la distribución por Gestora.** No es relevante.

### Archivos a tocar
- `tailwind.config.js`, `app/globals.css`
- `components/dashboard/ClientDashboard.tsx` (reorden)
- `components/tables/PositionsTable.tsx` (columnas y subsecciones)
- `components/charts/AssetDistribution.tsx` (donut tipo activo)

### Criterios de aceptación
- [ ] Sidebar, botones, headers usan `#3D4F63`.
- [ ] Contraste texto/fondo pasa WCAG AA (verificar con axe o lighthouse).
- [ ] Tabla de posiciones muestra dos subsecciones claramente separadas (IIC arriba, RV abajo, o viceversa).
- [ ] Columna "Gestora" ya no aparece.
- [ ] Donut de tipo de activo muestra 4 categorías, no por gestora.
- [ ] Tabla de posiciones está colapsada por defecto al abrir el dashboard.

---

## Tarea 11 — Logout idle con warning [INDEPENDIENTE]

### Contexto
Cerrar sesión automáticamente tras inactividad, pero con un aviso previo que permita al usuario seguir conectado.

### Objetivo
Implementar logout por inactividad con las siguientes reglas.

### Lógica

**Versión actual (mientras MVP6 está en hypercare):**
- **30 minutos** de inactividad → warning modal "¿Seguir conectado?" con botones "Sí, seguir" y "Cerrar sesión".
- Si no hay respuesta en **2 minutos adicionales** → `supabase.auth.signOut()` y redirect a login.

**Versión release (cuando MVP6 se abra a todos los clientes):**
- Reducir a **20 minutos** de inactividad (warning) + 2 min para responder.

**Definición de inactividad:**
- No hay eventos de mouse/keyboard/touch en la ventana.
- Cambio de pestaña no cuenta como inactividad (la pestaña sigue "viva").

### Archivos a tocar
- Nuevo hook `hooks/useIdleLogout.ts`
- Componente `components/auth/IdleWarningModal.tsx`
- Integrar en layout del dashboard (cliente y admin)
- Constante configurable: `IDLE_TIMEOUT_MS` y `WARNING_TIMEOUT_MS` en `lib/config.ts`

### Criterios de aceptación
- [ ] Tras 30 min sin eventos, aparece el modal.
- [ ] Clicar "Sí, seguir" cierra el modal y reinicia el timer.
- [ ] Clicar "Cerrar sesión" hace logout inmediato.
- [ ] Sin respuesta en 2 min → logout automático + redirect a `/login`.
- [ ] Timer se reinicia con cualquier evento mouse/keyboard/touch.
- [ ] Configuración de tiempos en una sola constante para cambiar fácilmente a 20 min en el release.

### Fuera de alcance
- 2FA, device fingerprinting, etc. — es MVP7.

---

## Fuera de alcance global de MVP6

Estas tareas NO se tocan en MVP6, están planificadas para MVP7 o más tarde:

- **Multi-tenancy** (tabla `advisors`, RLS por advisor_id) — depende del lead de la gestoría de Lleida.
- **Modelo matemático de las 4 rentabilidades (TWR exacto, MWR refinado, Acumulada)** — espera a input de Edgard.
- **Universo de fondos / scraping Morningstar** — feature nuevo, tarea aislada, se hará cuando haya bandwidth.
- **Módulo específico futbolistas** — branding vertical, futuro.
- **2FA** (doble autenticación con SMS/email/TOTP) — antes del release oficial.
- **Firma de contratos desde la plataforma** — DocuSign o similar, futuro.
- **Multi-titular / representantes legales** (Carlos Moreno, Aurum-077) — MVP7.
- **Botón de borrar datos** (admin) — utilidad, no bloquea MVP6.
- **Fix Safari iOS date picker** — ya está en el sumario, Edgard no lo menciona en v2 pero sigue siendo un bug conocido. Si no sale gratis al tocar `DashboardFilters.tsx` en otra tarea, se deja para parche posterior.

---

## Validación final de MVP6

Antes de merge a `main` y deploy a producción:

1. **Aurum-077 es el cliente de referencia**. Tiene que pasar todos estos tests visualmente y numéricamente:
   - [ ] Aportaciones netas acumuladas = 290.922,76 €
   - [ ] Rentabilidad con efecto divisa = 301.070,18 €
   - [ ] Marcador verde de operación #6988038 en 10 de febrero 2026
   - [ ] Tabla de posiciones muestra USD correctamente en sus acciones US
   - [ ] Dashboard carga en < 500ms (lista de clientes admin en < 300ms)

2. **Regresiones a verificar**:
   - [ ] Todos los clientes existentes siguen visualizándose.
   - [ ] Upload de Excel Mapfre sigue funcionando con la estructura conocida (`skiprows=2`).
   - [ ] Sistema de invitación de clientes sigue funcionando.
   - [ ] Login, logout, rate limiting, headers de seguridad, Sentry sin cambios en su funcionamiento.

3. **2-3 clientes adicionales de validación** (a definir con Edgard, uno simple solo con aportaciones, uno con retiradas, uno multi-divisa con varias CVs).

---

## Checklist de arranque para Claude Code

Antes de empezar cualquier tarea:

1. Crear rama por tarea: `feature/mvp6-<num>-<nombre>` (ej: `feature/mvp6-1-taxonomia-aportaciones`).
2. Leer el `CLAUDE.md` del repo (contexto persistente).
3. Confirmar que el schema Supabase actual está alineado con lo que la tarea asume. Si no, migración antes.
4. Escribir tests antes que código para las tareas con criterios numéricos (1, 3, 5, 9).
5. Validar contra Aurum-077 al final de cada tarea relevante.
6. Si hay ambigüedad o contradicción con el código existente, **parar y preguntar a Xabier** — no inventar.

---

**Fin del spec MVP6.**
