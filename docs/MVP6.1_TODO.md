# MVP6.1 — TODO

Trabajo diferido del MVP6 que se cerró con dos cambios pequeños pre-merge.

## 1. TWR calculation broken

TWR calculation broken — needs geometric TWR with subperiod cuts at each flow. Aurum-077 shows +128,69% vs real 24,29%.

**Dónde aparece el bug:**
- Cards `TWR 1M / 3M / YTD / 1A / ALL` (sección "Resumen de Cartera", row 2) — actualmente comentadas.
- Card `Variación` dentro del gráfico combinado de sección "Evolución Patrimonial" — actualmente comentada. Mostraba +128,69 % para Aurum-077.
- Card `Rent. periodo` en la misma fila de KPIs del gráfico combinado — actualmente comentada. Mostraba +46,94 % para Aurum-077.

**Causa:**
- `twrPeriods` en `components/dashboard/ClientDashboard.tsx` calcula `(totalValue − startValue) / startValue`, sin descontar los flujos intra-periodo. Para Aurum eso da 361.598 / 158.000 − 1 ≈ 128%.
- `variacion` en el mismo archivo calcula `lastNav − firstNav`, mismo defecto (no descuenta aportaciones).
- `rentabilidadPeriodo` en el mismo archivo encadena `cumReturn *= 1 + pt.returnPct/100` sobre los snapshots. El `returnPct` de cada snapshot ya se construye restando `flowsBetween`, pero el encadenado multiplicativo sobre-compondía cuando los flujos son grandes relativos al NAV de arranque, dando +46,94 % en Aurum frente al 24,29 % real.

**Fix correcto:**
- TWR geométrico: cortar el periodo en subperiodos delimitados por cada cash flow (PLUS/MINUS), calcular el retorno de cada subperiodo excluyendo el flow, y encadenar geométricamente los subperiodos.
- Fórmula por subperiodo `i`: `r_i = (NAV_end_i − Flow_i) / NAV_start_i − 1`.
- Retorno total: `TWR = Π(1 + r_i) − 1`.

**Referencia para QA:** cliente `Aurum-077`, valor esperado del calculo arreglado = 24,29 % (± 0,05 pp).

### TWR (criterios de aceptación MVP6.1)

No basta con arreglar la fórmula. Para que TWR vuelva a ser visible:

- [ ] Modelo matemático correcto (geométrico con cortes en cada flujo)
- [ ] Definir y aplicar validaciones de input:
  - Snapshots presentes en cada subperiodo
  - `operation_date` no null y consistente con snapshots
  - Flujos clasificados correctamente (taxonomía MVP6 T1)
  - Sin gaps de NAV histórico que invaliden el cálculo
- [ ] UI fallback "Datos insuficientes para TWR" cuando inputs no
      cumplen validación (no mostrar número incorrecto)
- [ ] Validación end-to-end contra Aurum-077 + al menos 2 clientes
      más con perfiles distintos

**Política:** TWR solo se muestra si los inputs garantizan integridad.
Es preferible "datos insuficientes" que un número falso que el cliente
confunda con su rentabilidad real.

**Estado actual del UI:** el toggle TWR/MWR está oculto en
`ClientDashboard.tsx` (bloque `HIDDEN UNTIL MVP6.1`). El state
`returnMethod`, los useMemos `twrPeriods`/`mwrPeriods` y la bifurcación
de `chartData.map(...)` siguen vivos. La línea de rentabilidad del chart
muestra TWR-subperiodo (default `"twr"`). Reactivar el selector cuando
los criterios de arriba estén cumplidos.

---

## Resolved in MVP6 final

### 2. Default date filter shows today/today instead of originDate/today ✅

**Resuelto.** `components/dashboard/ClientDashboard.tsx` expone un helper puro `computeOriginDate(ops)` que devuelve `MIN(operation_date)` sobre el histórico completo (o `null` si no hay ops). Lo usan dos sitios sin duplicacion:
- `useState` initializer de `dateFrom`: arranca en `initialData.dateFrom ?? computeOriginDate(ops) ?? today`.
- `useMemo` de `originDate`: alimenta el boton "Desde origen" de `DateRangeBar`.

`dateTo` arranca en `initialData.dateTo ?? today`. Si el cliente no tiene operaciones, ambos caen a `today/today` (estado original, sin romper nada).

Funciona con el histórico completo porque `initialData.operations.operations` viene ya sin paginar desde `getAllOperationsForAccounts` (MVP6 #6).
