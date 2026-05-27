# Rowell Dashboard — X-Ray de Cartera (MVP7)

**Fecha:** 27 mayo 2026
**Autor:** Xabier (apoyado en Claude)
**Target:** Claude Code · componente `XRayTab` del dashboard cliente
**Repo:** `xabierantonanzas-code/rowell-wm-mvp`
**Estado:** SPEC INICIAL — pendiente de validación de Edgard contra el componente real.

---

## 0. Propósito

Implementar la tab "X-Ray" del dashboard cliente: agregación look-through de la cartera contra los datos del Universo de fondos (`funds_universe` / `fund_data` que produce el pipeline Python v6+).

Reproducir el shape del X-Ray que Mapfre + Morningstar ya entregan hoy (`Ejemplo_XRay_1.pdf` y `Ejemplo_XRay_2.pdf` adjuntos por Edgard 2026-05) **adaptado a la cartera real del cliente** (no a las 5 posiciones equiponderadas del ejemplo).

Esta spec es el contrato del componente. Sin ella, no se empieza código (regla de `rowell-shared/pendientes.md`).

---

## 1. Fuentes de datos

| Datos | Tabla / fuente | Owner |
|---|---|---|
| Posiciones del cliente | `positions` (último snapshot por cuenta) + `cash_balances` | Dashboard (este repo) |
| Operaciones (para clasificar IIC vs RV) | `operations` con taxonomía `lib/operations-taxonomy.ts` | Dashboard |
| Universo de fondos (sectores, geografía, holdings RV+RF) | `funds_universe` + `fund_data` | Pipeline Python (rowell-funds-pipeline-python v6+) |
| Métricas RF (Duración efectiva, YTM, etc.) | columnas `rf_*` en `fund_data` | Pipeline v6 ✅ disponible |
| Métricas RV (P/E, P/B, etc.) | columnas `eq_*` en `fund_data` | Pipeline v6 ✅ disponible |
| Marcador "no disponible para X-Ray" | `xray_disponible` (bool) + `xray_nota` (texto) | Pipeline v6 ✅ disponible |
| ISIN proxy de aproximaciones | `isin_proxy_real` | Pipeline ⚠️ pendiente (TODO #1 notas 17/5) |

**Decisión del 2026-05-22 (de Edgard):** el X-Ray **NO descarta** ningún ISIN. Incluye todos los fondos y muestra un bloque de WARNINGs al principio para los singulares (no encontrado, parcial, mismatch, aproximación). Esto revisa la decisión inicial de `xray_disponible` como gate duro — pasa a ser informativo (Workstream D del plan-tecnico-feedback-v6.md).

---

## 2. Layout del componente

Tres bloques verticales, una sola pestaña.

### Bloque 1 — Avisos (header)

Banner colapsable al principio con un resumen tipo:

> "X cobertura del X-Ray: 96,4 % del valor de cartera. 3 posiciones con avisos: 1 fondo no encontrado en universo, 2 con datos aproximados de otra clase del mismo fondo."

Listado expandible con una línea por fondo afectado:

- `ISIN` — `Nombre` — `Motivo` (texto de `xray_nota` o `motivo_no_encontrado`)
- Para `aprox=SI`: "Datos aproximados leídos del ISIN `{isin_proxy_real}` de la familia"

Si todo OK, banner verde "Cobertura X-Ray completa".

### Bloque 2 — Composición de cartera

Replica el layout del PDF Mapfre, pero con datos del cliente.

#### 2.1 Top-N fondos en cartera (tabla cabecera)

| Nombre | Peso (%) | 3 Años Anualizado | Vol. |

- Top 10 posiciones de IIC ordenadas por peso descendente.
- "Peso (%)" = `position_value` / `patrimonio_invertido_total` (sin saldo CE).
- "3 Años Anualizado" = `fund_data.rent_3Y_anual`.
- "Vol." = `fund_data.vol_3Y`.
- Posiciones RV individuales aparecen separadas (sin métricas de fondo).

#### 2.2 Distribución de Activos

Barra horizontal estilo PDF (`-100 ... 0 ... +100`) + tabla:

| Categoría | Largo | Corto | Patrimonio |
|---|---|---|---|
| Acciones | ... | ... | ... |
| Obligaciones | ... | ... | ... |
| Efectivo | ... | ... | ... |
| Otro | ... | ... | ... |
| No clasificado | ... | ... | ... |

**Cálculo:** suma ponderada sobre los fondos del cliente, donde cada fondo aporta su `pct_Equity`, `pct_FixedIncome`, `pct_Cash`, `pct_Other`, `pct_Preferred`, `pct_Convertible` de `fund_data`, ponderado por su peso en cartera.

- Efectivo incluye `cash_balances` reales del cliente además del cash de los fondos.
- Posiciones directas RV (acciones individuales) → 100 % Acciones.
- "No clasificado" = % de valor de cartera en posiciones cuyo `xray_disponible=false`.

#### 2.3 Rango de vencimientos (renta fija)

Tabla con 8 buckets: `1 a 3`, `3 a 5`, `5 a 7`, `7 a 10`, `10 a 15`, `15 a 20`, `20 a 30`, `Más de 30`.

**Pendiente pipeline:** estas columnas (`rf_vencimientos_*`) aún no existen en `fund_data` v6. Hay `rf_DuracionEfectiva` agregada pero no el breakdown por bucket. TODO añadir al pipeline.

Si no hay datos RF (cartera 100 % RV) → tabla con guiones, como en `Ejemplo_XRay_1.pdf`.

#### 2.4 Desglose por regiones

3 columnas (Europa/O.Medio/África, América, Asia) con sub-líneas:

- **Europa/O.Medio/África:** Reino Unido, Europa Occidental - Euro, Europa Occidental - No Euro, Europa Emergente, Oriente Medio / África
- **América:** Estados Unidos, Canadá, América Latina y Centroamérica
- **Asia:** Japón, Australasia, Los 4 tigres, Asia Emergente - Ex. 4 tigres

Mapeo desde `fund_data`:

| Sub-región PDF | Columna `fund_data` |
|---|---|
| Reino Unido | `reg_UK` |
| Europa Occidental - Euro | `reg_EuropeDeveloped` (Euro) — TODO confirmar split |
| Europa Occidental - No Euro | `reg_EuropeDeveloped` (No Euro) — TODO |
| Europa Emergente | `reg_EuropeEmerging` |
| Oriente Medio / África | `reg_AfricaMiddleEast` |
| Estados Unidos | `reg_NorthAmerica` (US) — TODO confirmar split US/CA |
| Canadá | `reg_NorthAmerica` (CA) — TODO |
| América Latina | `reg_LatinAmerica` |
| Japón | `reg_Japan` |
| Australasia | `reg_Australasia` |
| Los 4 tigres | `reg_AsiaDeveloped` |
| Asia Emergente - Ex. 4 tigres | `reg_AsiaEmerging` |

**TODO:** revisar si el pipeline expone los splits (US vs CA, Euro vs No Euro). Si no, agrupar y dejar el detalle vacío.

Solo cuenta la parte accionaria de la cartera (igual que el PDF Morningstar).

#### 2.5 Sectores de Renta Variable

3 super-sectores con 11 sub-sectores:

- **Cíclico:** Materiales Básicos (`sec_BasicMaterials`), Consumo Cíclico (`sec_ConsumerCyclical`), Servicios Financieros (`sec_FinancialServices`), Inmobiliario (`sec_RealEstate`)
- **Sensible al ciclo:** Servicios de Comunicación (`sec_CommunicationServices`), Energía (`sec_Energy`), Industria (`sec_Industrials`), Tecnología (`sec_Technology`)
- **Defensivo:** Consumo Defensivo (`sec_ConsumerDefensive`), Salud (`sec_Healthcare`), Servicios Públicos (`sec_Utilities`)

Total por super-sector + breakdown. Triángulo Cíclico/Sensible/Defensivo opcional (puede ser solo 3 barras horizontales en MVP7).

Comparación contra benchmark (FTSE All-World o equivalente) → fuera de alcance MVP7. Spec lo deja preparado pero render sin benchmark.

#### 2.6 Las 10 principales posiciones (look-through)

Tabla:

| Activos % | Nombre | Tipo | Sector | País |

Suma look-through de los `top1_name` ... `top10_name` (+ `top1_pct` ... `top10_pct`) de cada fondo en cartera, ponderado por el peso del fondo. Si un mismo holding aparece en varios fondos, se suma.

Top 10 final del cliente, ordenado por peso descendente.

Posiciones RV directas del cliente cuentan al 100 % de su peso (no necesitan look-through).

**Limitación:** la columna `top_pct` del pipeline es % dentro del fondo. Por look-through: `holding_pct_cartera = top_pct × fund_weight`. Aproximado porque solo tenemos los top 10 de cada fondo (los demás holdings no se persisten).

### Bloque 3 — Rentabilidad (opcional MVP7)

El PDF Mapfre dedica la página 2 entera a esto: crecimiento de EUR 10.000, rentabilidad anual, mejor/peor periodo, resumen.

**Decisión:** este bloque depende del modelo matemático de 4 rentabilidades (item 16 WM Platform doc, bloqueado por Edgard). **NO entra en el MVP7 inicial.** Se reactiva con MVP6.1.

En la spec se reserva el espacio pero el componente renderiza "Datos insuficientes — pendiente modelo de rentabilidades" (consistente con la política TWR del `MVP6.1_TODO.md`).

---

## 3. Fórmulas y reglas

### 3.1 Peso de un fondo en cartera

```
peso_fondo_i = position_value_i / SUM(position_value para IIC + RV)
```

Saldo en efectivo (`cash_balances`) NO entra en el peso para distribución sectorial/geográfica/holdings — entra solo en "Distribución de Activos" (categoría Efectivo).

### 3.2 Agregación look-through

Para cada métrica X de un fondo (sector, geografía, top holding, métrica RF/RV):

```
X_cartera = SUM(X_fondo_i × peso_fondo_i) sobre todos los fondos
```

Si el fondo es `xray_disponible=false`, su peso se acumula en "No clasificado".

### 3.3 Cobertura del X-Ray

```
cobertura_pct = SUM(peso_fondo_i para fondos con xray_disponible=true)
              + SUM(peso_pos para RV directa con fund_data conocido)
```

### 3.4 Look-through de holdings

```
top_holdings_cartera = ordenar_desc(
  agrupar_por_nombre(
    flatten([
      [(holding.name, holding.pct × fund.peso) para holding in fund.top10]
      para fund in fondos_cliente
    ])
  )
).limit(10)
```

Mismo holding en varios fondos → se suman pcts.

---

## 4. UI / UX

### Layout

- Tab "X-Ray" como **tab nuevo** en `ClientDashboard`, junto a las tabs actuales (Resumen, Posiciones, Operaciones...).
- Colapsable arriba: banner de cobertura/avisos.
- Cuerpo: 3 columnas en desktop, stack vertical en mobile.
  - Col izquierda: Distribución de Activos + Rango de vencimientos
  - Col centro: Desglose por regiones + mapa
  - Col derecha: Sectores RV (triángulo + tablas)
- Footer: Top 10 holdings (tabla full-width).

### Paleta (MVP6 / Edgard)

- `primary` #3D4F63 (headers, líneas, leyendas)
- `gold` #B8965A (acentos, hover, indicador "Cartera")
- `bg` #F5F5F5
- `ink` #1A1A1A
- Gráficos: barras verde (Acciones), azul (Obligaciones), gris (Efectivo), naranja (Otro), gris claro (No clasificado).

### Estados

- **Loading:** skeleton por bloque.
- **Empty (cliente sin posiciones IIC):** mensaje "Sin fondos en cartera. El X-Ray analiza la distribución look-through de los fondos. Las acciones directas aparecen en el bloque Posiciones."
- **Error (Universo no disponible):** fallback a "Universo de fondos no disponible. Reintentando..." y reintentar con backoff.

---

## 5. Validación

### 5.1 Test contra los PDFs de Edgard

Reproducir las dos carteras de ejemplo y verificar que los agregados coinciden ±0,5 pp por categoría.

**Cartera ejemplo 1** (BGF Tech / Brandes US Val / Eleva Eur Sel / GS US Core / T.Rowe US Smlr — 5 fondos equiponderados al 20 %):

| Métrica | Esperado |
|---|---|
| Acciones (largo) | 98,38 % |
| Efectivo (largo) | 3,42 % |
| América - Estados Unidos | 73,22 % |
| Asia - Los 4 tigres | 3,64 % |
| Sector Tecnología | 28,68 % |
| Sector Salud | 13,52 % |
| Top 1 holding | NVIDIA Corp, 3,41 % |
| Top 2 holding | Apple Inc, 2,85 % |

**Cartera ejemplo 2** (Comgest Eur Gr / Fed Hermes Asia / JPM Global / JPM US Sel / JPM US Tech — 5 fondos al 20 %):

| Métrica | Esperado |
|---|---|
| Acciones (largo) | 98,72 % |
| América - Estados Unidos | 53,71 % |
| Asia - Los 4 tigres | 10,86 % |
| Sector Tecnología | 32,20 % |
| Top 1 holding | NVIDIA Corp, 3,97 % |
| Top 4 holding | Taiwan Semiconductor, 2,06 % |

Si los 5 ISINs de cada cartera están en el universo v6, podemos correr el agregado contra `fund_data` y comparar.

### 5.2 Validación cliente real

- **Aurum-077** (17 posiciones IIC, todo en universo) — primera cartera real para validar visualmente con Edgard.
- Cobertura esperada ≥ 95 %.
- Top 10 holdings cuadran con los nombres conocidos del cliente.

### 5.3 Tests unitarios

- `lib/queries/xray.ts` — agregación look-through pure functions.
- 5+ tests: 1 fondo, N fondos equiponderados, N fondos con pesos distintos, fondo con xray_disponible=false, posición RV directa.

### 5.4 Validación Aurum-077 sigue verde

`scripts/validate-aurum077.mjs` debe seguir pasando 9/9 OK. El X-Ray no toca cálculo de aportaciones/rentabilidad, solo lee positions + funds_universe → no debería afectar.

---

## 6. Fases de entrega

| Fase | Alcance | Tiempo estimado |
|---|---|---|
| **F0 — Spec aprobada** | Este doc | Hecho |
| **F1 — Scaffold + UI placeholder** | `XRayTab.tsx` con datos hardcoded del Ejemplo 1, integrado en ClientDashboard | 1 día |
| **F2 — Foundation cross-repo** | Migración `mvp7_001_funds_universe_read.sql`, `lib/queries/funds.ts`, tipos | 1 día |
| **F3 — Agregación look-through** | `lib/queries/xray.ts` con las funciones puras + tests | 1 día |
| **F4 — Wire-up real data** | Conectar XRayTab a queries reales, validar contra cliente Aurum-077 | 1 día |
| **F5 — Visual polish + avisos** | Banner de cobertura, paleta MVP6, responsive | 0,5 día |
| **F6 — Demo Edgard + ajustes** | Email a Edgard con cartera ejemplo + Aurum-077, recoger feedback | 0,5 día |

**Total:** ~5 días efectivos. F1 entra ya (sin esperar Edgard). F2-F6 requieren migración aplicada en Supabase SQL Editor y pipeline expone `isin_proxy_real`.

---

## 7. Fuera de alcance MVP7

- **Bloque 3 Rentabilidad** completo (depende del modelo de 4 rentabilidades — Edgard).
- **Comparación contra benchmark** (FTSE All-World).
- **Triángulo gráfico Cíclico/Sensible/Defensivo** (la spec admite 3 barras horizontales como first pass).
- **Splits US vs CA y Euro vs No Euro** (depende de pipeline).
- **Rango de vencimientos detallado** (depende de pipeline añadir buckets RF).
- **Sectores RF + métricas RF agregadas** (Duración efectiva ponderada, YTM ponderado) — entra en MVP7.1 si hay tiempo.
- **Look-through más allá de top 10** (solo persistimos top 10 de cada fondo).
- **Carteras teóricas / what-if** — feature futura.

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Pipeline expone columnas distintas a lo que pide esta spec | F2 verifica el esquema real antes de codear F3 |
| `isin_proxy_real` no llega a tiempo | F1-F5 funcionan sin él; el aviso de aproximación dice "datos de otra clase" sin especificar ISIN proxy |
| Look-through aproximado por solo top 10 holdings | Documentar limitación en disclaimer del componente. Edgard ya lo asume (PDF Morningstar también es look-through aproximado) |
| Migración cross-repo rompe pipeline | Pipeline solo escribe en `funds_*`, dashboard solo lee. Boundaries claras en CLAUDE.md de cada repo |

---

## 9. Referencias

- `Ejemplo_XRay_1.pdf` y `Ejemplo_XRay_2.pdf` (Edgard, mayo 2026) — visual target.
- `data/raw data folder/WM Platform-5/WM Platform improvements_v2.docx` — item 12 (X-Ray).
- `rowell-shared/edgard-emails/2026-04-28-edgard-feedback-universo-v3.md` — variables RF/RV.
- `rowell-shared/CHANGELOG.md` v6 — columnas disponibles en `fund_data`.
- `Rowell Patrimonios/comunicaciones/2026-05-22-plan-tecnico-feedback-v6.md` — Workstream D (warnings en X-Ray).
- `docs/MVP6.1_TODO.md` — política "datos insuficientes" para métricas no garantizadas.
