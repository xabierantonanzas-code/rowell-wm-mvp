# Rowell Dashboard

Dashboard de seguimiento de carteras para Rowell, un wealth manager que opera
sobre la plataforma de Mapfre Inversión. Pinta posiciones, operaciones,
saldos, rentabilidades y aportaciones de cada cliente.

## Stack

- **Next.js 14 (App Router)** + TypeScript + Tailwind CSS
- **Supabase** (Postgres + Auth + Storage + RLS)
- **Recharts** para gráficos
- **xlsx** para parsear los Excel de Mapfre

## Comandos clave

```bash
# Dev server
npm run dev

# Type check (úsalo antes de commitear cambios grandes)
npx tsc --noEmit

# Validar números contra el caso de referencia Aurum-077
node scripts/validate-aurum077.mjs

# Carga masiva del registro de operaciones (idempotente, upsert)
node scripts/load-operations.mjs
node scripts/load-operations.mjs path/to/Registro_Operaciones.xlsx
```

Node está en `/opt/homebrew/bin/node` o vía `nvm`. El binario `node` no
está en el PATH por defecto en algunas shells — usa la ruta completa si
falla.

**Tras `git clone`** (o tras pull si nunca corriste el setup): ejecutar
`bash scripts/install-hooks.sh` una vez para activar el hook `pre-push`
que valida `Aurum-077` antes de cada push. Bypass puntual con
`git push --no-verify` (ej. WIP branch).

## Estructura

```
app/(authenticated)/   Páginas autenticadas (dashboard, admin, upload, ayuda)
app/api/upload-excel/  Endpoint de subida de Excel Mapfre
components/
  dashboard/           Componentes del dashboard cliente
  admin/               Vista admin (selector de clientes + KPIs agregados)
  auth/                IdleLogoutWatcher (logout 10min inactividad)
  layout/              Sidebar
lib/
  parsers/             Parser de Excel Mapfre
  queries/             Queries Supabase agrupadas por dominio
  types/               Tipos generados de Supabase + tipos Excel
  operations-taxonomy.ts  ← FUENTE DE VERDAD PLUS/MINUS/NEUTRO
  eur-cost-fifo.ts        ← FIFO de coste EUR para P&L con efecto divisa
  product-type.ts         ← Heurística IIC vs RV
data/
  migrations/          SQL files (numeradas 001_, 002_, ...)
  customer data/       Excel reales de Mapfre (gitignored idealmente)
scripts/
  validate-aurum077.mjs  Script de validación numérica
  load-operations.mjs    Carga masiva de operations
```

## Caso de validación: Aurum-077

`Aurum-077-W37Q` es el cliente de referencia que Edgard usa para validar
todos los cálculos. Los números esperados (snapshot 2026-03-18):

| Métrica | Valor esperado |
|---|---|
| Saldo CE | 2.522,18 € |
| Valor cartera (invertido) | 361.598,11 € |
| Patrimonio total | 364.120,29 € |
| Patrimonio invertido (PLUS-MINUS) | 290.922,76 € |
| Rentabilidad acumulada | 70.675,35 € (24,29 %) |

El script `scripts/validate-aurum077.mjs` los compara contra Supabase y
debe pasar **6/6 hard checks**. Los 3 WARN del FIFO son por datos
incompletos (el registro de operaciones de Mapfre solo cubre desde
2021-01-01, hay compras anteriores sin lots).

**Si tocas algo que afecte a flujos, taxonomía o FIFO, ejecuta el script
antes de commitear.**

## Convenciones críticas

### 1. Taxonomía oficial PLUS / MINUS / NEUTRO

`lib/operations-taxonomy.ts` es la **única fuente de verdad** para
clasificar operaciones. **Nunca** usar `.includes("compra")` o similar —
captura mal los neutros (fusiones, traspasos internos, splits).

- **PLUS** (aporta capital): SUSCRIPCIÓN FONDOS INVERSIÓN, COMPRA RV
  CONTADO, COMPRA SICAVS, RECEPCION INTERNA IIC LP, SUSC.TRASPASO EXT.
- **MINUS** (sale capital): VENTA RV CONTADO, LIQUIDACION IICS,
  TRASPASO INTERNO IIC LP, REEMBOLSO FONDO INVERSIÓN, REEMBOLSO
  OBLIGATORIO IIC, REEMBOLSO POR TRASPASO EXT.
- **NEUTRO**: todo lo demás (fusiones, splits, switches, traspasos
  internos puros, ajustes…).

Cálculo del flujo:
- **PLUS**: usar `eur_amount` (CONTRAVALOR EFECTIVO NETO, col 24).
- **MINUS**: usar `gross_amount × fx_rate` (EFECTIVO BRUTO × CAMBIO
  DIVISA, cols 21×23). NO `eur_amount` — el bruto es lo que sale de la
  cartera, el neto difiere por comisiones/retenciones.
- **NEUTRO**: 0.

Helper centralizado: `flowAmountEur(op)` en `lib/operations-taxonomy.ts`.

### 2. Fórmulas de patrimonio

- `valor_cartera` = SUM(positions.position_value) del último snapshot
- `saldo` = SUM(cash_balances.balance) del último snapshot
- `patrimonio_total` = `valor_cartera + saldo`
- `patrimonio_invertido` = SUM(PLUS) − SUM(MINUS) sobre todas las
  operaciones (no solo del periodo)
- `rentabilidad_acumulada` = `valor_cartera − patrimonio_invertido`
  (¡NO restes el saldo!)
- `rentabilidad_acumulada_%` = `rentabilidad_acumulada / patrimonio_invertido × 100`

### 3. Migraciones Supabase

Las migraciones DDL (CREATE TABLE / ALTER / CREATE MATERIALIZED VIEW)
**no se pueden aplicar via la API REST con el service_role_key**. Hay
que copiar el SQL y pegarlo en el SQL Editor de Supabase manualmente.

Las migraciones existentes (`data/migrations/`):
1. `001_security_logs.sql` ✅ aplicada
2. `002_token_usage.sql` ✅ aplicada
3. `003_invitations.sql` ✅ aplicada
4. `004_performance_indices.sql` ✅ aplicada
5. `005_account_holders.sql` ⚠️ pendiente (multi-titular MVP6 #9)
6. `006_account_profile.sql` ⚠️ pendiente (perfil CV MVP6 #9b)
7. `007_client_summary_mv.sql` ⚠️ pendiente (vista materializada MVP6 P2)

El código tiene **fallback graceful** para las migraciones pendientes:
si la tabla/vista no existe, cae al esquema legacy.

### 4. Paleta MVP6 (Edgard)

```
primary  #3D4F63   (sidebar, headers, botones primarios)
gold     #B8965A   (acentos, hover, indicadores)
bg       #F5F5F5   (fondo body)
text     #1A1A1A   (texto principal)
```

Definida en `tailwind.config.ts` (clases `primary-*`, `gold-*`, `bg-*`,
`ink-*`) y `app/globals.css` (CSS variables `--color-*`).

Los hex legacy `#0B1D3A`, `#1e3a5f`, `#C9A84C`, `#c9a94e`, `#F5F3EE`
quedan reemplazados pero el find/replace los dejó hardcoded en muchos
sitios — para nuevos componentes usa las clases de Tailwind, no hex.

Aliases legacy `rowell-navy / rowell-gold / rowell-light / rowell-dark`
siguen funcionando porque apuntan a la paleta nueva.

### 5. Producto IIC vs RV

`lib/product-type.ts` clasifica por heurística:
- ISIN US**, CA**, BM**, KY** → RV
- ISIN LU**, IE** → IIC
- Resto + nombre con `INC|CORP|MOTORS|LTD|PLC|SA|AG…` → RV
- Resto → IIC

No hay campo `product_type` en `positions` (Mapfre no lo expone). Si
necesitas certeza absoluta toca añadir migración + parser que lea
REG_OP_7 del Excel de operaciones.

## Convenciones heredadas (ClaudeOS knowledge)

Reglas globales del usuario en `~/Desktop/ClaudeOS/knowledge/guidelines/`
que aplican a este proyecto:

### Git commits
Formato: `tipo(scope): descripción`

Tipos: `feat | fix | chore | refactor | docs | style | test`

Ejemplos:
```
feat(mvp6): añadir taxonomía PLUS/MINUS y FIFO eur-cost
fix(dashboard): date picker no abre en Safari iOS
chore(deps): subir supabase-js a 2.x
refactor(operations): centralizar clasificación en lib/operations-taxonomy.ts
```

Aplica a partir del próximo commit. Los commits MVP6 ya hechos
(`620c739`, `40fc1e7`) se quedan como están — reescribir history
es trabajo gratis con riesgo.

### Naming
- Componentes: `PascalCase` (`PositionsTable.tsx`)
- Funciones/hooks: `camelCase` (`getClientAccounts`)
- Archivos lib/utils: `kebab-case` (`eur-cost-fifo.ts`, `operations-taxonomy.ts`)
- Constantes: `UPPER_SNAKE_CASE` (`PLUS_TYPES`, `STORAGE_KEY`)

### Principios generales
- TypeScript estricto, sin `any` implícitos. Si necesitas `any` en un
  cast puntual, usar `as any` con comentario explicando por qué
- Server Components por defecto; `"use client"` solo cuando hace falta
- RLS habilitado en TODAS las tablas Supabase (sin excepción)
- Variables de entorno en `.env.local`, nunca hardcodeadas
- Manejo de errores explícito en async (no swallow)

## Seguridad — siempre

Este dashboard maneja datos financieros reales de múltiples clientes. La
seguridad es preocupación de primera clase, no review opcional al final.

**Antes de commitear cualquier cambio que toque auth, queries, API routes,
uploads, forms, sesión o RLS, hacer pasada mental de OWASP Top 10.**

Checklist mínimo:
- **RLS**: cualquier tabla nueva lleva policies en la misma migración. Las
  policies existentes filtran por `auth.uid()` vía `clients.auth_user_id`
  (legacy) o `account_holders` (MVP6 #9 cuando esté aplicado).
- **Auth en API routes**: primera línea del handler es
  `await supabase.auth.getUser()` + verificación de rol cuando aplique
  (`admin` / `owner` para uploads, admin panel; `client` para dashboard
  propio). No filtrar por IDs que vienen del cliente sin verificar
  ownership.
- **Input validation**: todo input externo (formData, query params, body)
  se valida con Zod o equivalente. Especialmente fechas, rangos, IDs,
  account_numbers, ISINs.
- **Service role key**: solo en código server-side. **Nunca** en
  componentes `"use client"` ni en bundles que llegan al navegador.
  El cliente admin (`@/lib/supabase/admin`) solo se importa desde rutas
  API o server components.
- **Secrets**: nunca hardcoded. Solo `.env.local` (gitignored) y env vars
  de Vercel. Si ves uno hardcoded en código existente, flagearlo.
- **Headers de seguridad**: middleware mantiene CSP, X-Frame-Options,
  HSTS, etc. No saltarlos en rutas nuevas.
- **Rate limiting**: las rutas de upload, login e invitación tienen
  limits. Cualquier nueva ruta sensible debe heredar el mismo patrón.
- **Logging**: errores van a Sentry. No loguear PII innecesaria (emails
  completos, DNIs, números de cuenta sin enmascarar).
- **Prompt injection** (Claude API): si los inputs del usuario llegan a un
  prompt de Claude, sanitizar y delimitar. Nunca confiar en lo que dice
  el modelo sobre acciones a tomar — el usuario tiene la palabra final.

**Antes de commitear cambios sensibles, invocar la skill
`owasp-security`** (instalada en `~/.claude/skills/owasp-security/`).
Cubre OWASP Top 10:2025, ASVS 5.0, OWASP Agentic AI 2026 con checklist
accionable. Usar específicamente cuando el cambio toca:
- Auth (signin, signout, sessions, RLS, roles)
- API routes nuevas o modificadas
- Queries que usan service_role_key
- Uploads de archivos
- Forms que reciben input del usuario
- Migraciones SQL con nuevas tablas/policies

Si detectas una vulnerabilidad existente al pasar por el código aunque
no sea tu scope, **flagéala al usuario antes de seguir**.

## Personas y división de responsabilidades

- **Edgard** (`e.font@rowellpatrimonios.com`, rol `admin` en la app):
  socio funcional, no técnico. Aporta los datos, la spec, los casos
  de validación numérica y el contacto con clientes. Sus entregables
  Word/Excel (`WM Platform improvements.docx`, `WM Platform - Data &
  Dashboards.xlsx`) son la **fuente de verdad funcional**. Edgard
  **no tiene acceso** a Supabase, GitHub ni Vercel — solo a la app.

- **Xabier** (`xabier.antonanzas@gmail.com`, rol `owner`):
  implementación + branding + infra + performance. Toca código,
  gestiona tokens y costes, define el look & feel, maneja el deploy.

- **Cliente demo**: `demo@rowell.es` / `Demo2026!` (ver vista cliente).

**Pendings que son DE Edgard, no de Xabier** (no tocar desde código):
1. Actualizar el Excel `Registro_Inversores.xlsx` (sacar DNIs, añadir
   campos nuevos, categorizar perfil de todas las CVs)
2. Mandar el Excel Universo de fondos (~200 fondos) cuando lo tenga
3. Mandar fotos comerciales personales/profesionales para la landing

## IDs estandarizados de variables Mapfre

Edgard quiere que usemos IDs cortos en reportes y comunicación para
hablar el mismo idioma. Los Excel de Mapfre exponen estas variables
con un identificador único:

| Excel | Prefijo | Ejemplo | Significado |
|---|---|---|---|
| Registro_Inversores | `CL_` | CL_1 = Nombre inversor | Datos del cliente |
| Registro_Operaciones | `REG_OP_` | REG_OP_4 = TIPO DE OPERACION IB | Movimientos |
| Saldos | `SAL_` | SAL_3 = SALDO | Cuenta de efectivo |
| Posiciones | `POS_` | POS_11 = COSTE MEDIO POSICIÓN | Cartera |

Variables clave por columna (verificadas con archivos reales):

**Operaciones (`_Pos.xlsx` no, `Registro_Operaciones.xlsx`)**:
- Col[14] `REG_OP_15` FECHA DE CONTRATACION ← fecha de cualquier flujo
- Col[21] `REG_OP_22` EFECTIVO BRUTO (divisa origen)
- Col[23] `REG_OP_24` CAMBIO DE LA DIVISA
- Col[24] `REG_OP_25` CONTRAVALOR EFECTIVO NETO (EUR)
- Col[7] `REG_OP_8` CODIGO ISIN
- Col[6] `REG_OP_7` PRODUCTO ← "IIC" o "RV", **fuente fiable de tipo**

**Posiciones (`_Pos.xlsx`)** — todas con `skiprows=2`:
- Col[0] FECHA, Col[1] CUENTA DE VALORES, Col[2] ISIN
- Col[6] DIVISA ← divisa original del activo
- Col[8] TOTAL TITULOS, Col[10] COSTE MEDIO POSICIÓN
- Col[11] PRECIO MERCADO (en divisa origen)
- Col[12] POSICION ← **siempre EUR**
- Col[14] CAMBIO EUR
- Fórmula confirmada: `POSICION = TOTAL_TITULOS × PRECIO_MERCADO × CAMBIO_EUR`

**Saldos (`_Saldo.xlsx`)** — `skiprows=2`, 13 columnas:
- Col[0] FECHA, Col[1] CUENTA DE EFECTIVO, Col[3] SALDO, Col[4] SIGNO
- La divisa del saldo es siempre EUR

## Frecuencia de actualización

**Semanal**: el viernes/sábado se descargan los 3 Excels (positions +
saldos + operaciones). Por eso el eje X de los gráficos debe mostrar
el día además del mes/año.

Los datos de **saldo y posiciones** solo existen en fechas de
consulta (snapshot semanal). Los **datos de operaciones** pueden ser
de cualquier día. Por eso la línea de aportaciones netas en el gráfico
combinado debe ser continua, no por fecha de snapshot.

## Tipo de cambio (FX rate)

**Usar SIEMPRE el `cambio_eur` que viene en el propio Excel de Mapfre.**
Nunca buscar fx rates en fuentes externas (Bloomberg, Yahoo, ECB...).
Mapfre aplica un spread propio sobre el rate de mercado, y para que
los números cuadren con lo que ve el cliente en su extracto, hay que
usar el rate de Mapfre tal cual.

- En `positions`: campo `fx_rate` = Col[14] CAMBIO EUR
- En `operations`: campo `fx_rate` = Col[23] CAMBIO DE LA DIVISA


## No-hacer / "gotchas"

- **No** usar `account_number ilike '%077%'` para buscar Aurum-077 —
  hay otras cuentas (Níquel-092) que terminan en `077`. Buscar por
  `clients.full_name ilike '%aurum-077%'`.
- **No** confíes en que las operations están todas cargadas. La BD
  empezó con 1 sola operation hasta que el script de carga masiva
  importó 10.451 desde el Excel. Si los flujos salen 0, comprueba
  primero si hay datos.
- **No** restar el saldo CE al calcular rentabilidad acumulada. Es
  contra el valor_cartera, no contra el patrimonio_total.
- **No** uses RLS de Supabase asumiendo que `clients.auth_user_id` está
  poblado para todos — algunos clientes están "unassigned".
- **Operaciones NEUTRAS** no afectan a flujos pero pueden contener
  unidades (splits). El FIFO actual las ignora, lo cual puede causar
  drift en posiciones que han sufrido splits. Caso raro en la cartera
  Rowell por ahora.

## MVP6 (Abril 2026) — estado

Ver `WM Platform improvements.docx` para la spec completa. Estado de
los 13 puntos de Edgard:

- ✅ #1 Logout idle 10min
- ✅ #2 Gráfico combinado:
    - 2a línea continua de aportaciones netas + marcadores PLUS verde
      / MINUS rojo en fecha exacta (Scatter dentro del chart)
    - 2b NAV apilado en cash / IIC / RV (clasificación desde
      operation_type de la 1ª compra, fuente fiable)
    - 2c eje temporal alineado NAV ↔ línea rentabilidad
    - 2d label de eje X con día (`18 mar 26`)
- ✅ #3 Date picker iOS Safari (showPicker + type=date constante con
      label flotante). Aplicado en ClientDashboard y AdminDashboard
- ✅ #4 Botones 1M / YTD / 1A / Origen (origen = 1ª op de la CV)
- ✅ #5 Taxonomía PLUS/MINUS/NEUTRO con la lista exacta de Edgard,
      MINUS = `gross_amount × fx_rate`, PLUS = `eur_amount`
- ✅ #6 Validación contra Aurum-077 (6/6 hard checks OK al céntimo).
      Tile "Patrimonio total" arreglado para incluir saldo. Tile
      "Patrimonio invertido" arreglado para mostrar PLUS-MINUS reales.
      Nuevo tile "Rentabilidad acumulada" = valor_cartera - invertido
- ⏭️ #7 No existe (Edgard saltó la numeración)
- ⚠️ #8 **MVP7 según Edgard, hecho parcialmente en MVP6 como
      anticipación**. FIFO de coste EUR sobre operations en runtime
      (`lib/eur-cost-fifo.ts`). Da resultados aproximados por el
      gap histórico (operations desde 2021-01-01, hay compras
      anteriores). En MVP7 se completará guardando `purchase_eur_cost`
      en BD. **No presentar como "P&L con efecto divisa real"**, mantener
      el disclaimer. Fallback graceful si no hay datos
- ⚠️ #9 **MVP7 según Edgard, hecho parcialmente como anticipación**.
      Migración 005 (account_holders many-to-many), 006 (account_profile)
      escritas y código adaptado con fallback graceful, pero las
      migraciones SQL **NO se aplican hasta MVP7** porque Edgard tiene
      pendings funcionales primero (actualizar Excel de clientes,
      categorizar perfiles)
- ✅ #10 PositionsTable: divisa junto a coste/precio (POS_7),
      subsecciones IIC/RV (clasificación desde REG_OP_7), sin
      columna Gestora, P&L EUR + %
- ✅ #11 Selectores (cuenta, fecha, TWR/MWR) en barra superior
- ⏸ #12 Excel Universo de fondos — **MVP futuro**, esperando archivo
      de Edgard. Spec: ~200 fondos seleccionados por Mapfre con
      rentab 3/5/10y, Sharp, distribución geográfica/sectorial.
      Fuente Morningstar (con fricción anti-bot). Update mensual.
      Habilita: distribución sectorial/geográfica de cartera + montar
      carteras teóricas. Edgard cree que es de alta monetización
- ⏭️ #13 Vacío en el doc

Commits MVP6:
- `620c739` parte 1 — taxonomía, FIFO, IIC/RV, validación Aurum-077
- `40fc1e7` parte 2 — paleta, idle logout, gráfico combinado
- + ajustes post-reunión Edgard (próximo commit)

## Barreras MVP6 / MVP7 / Universo

**Importante**: respetar las barreras entre MVPs. Si una iteración
declara un punto como "MVP7" o "MVP futuro", **NO adelantarlo a MVP6
sin preguntar al usuario**, aunque el código "técnicamente esté listo".
Razón: Edgard puede tener pendings funcionales que bloquean (ej:
multi-titular requiere primero categorizar las CVs, perfiles requiere
primero actualizar el Excel de clientes). Adelantar trabajo crea
deuda invisible.

En este proyecto MVP6 hay código adelantado de MVP7 (#8 FIFO y #9
multi-titular) por una decisión explícita del usuario ("haz todos los
puntos") + esta nota es el recordatorio de que ese código existe pero
está en modo "fallback graceful" y se activa cuando MVP7 cierre el
círculo.

---

## Session logging (a partir de 26/04/2026)

Tras cada tarea importante (commit, migración aplicada, decisión
arquitectónica), añade una entrada a `docs/sessions/YYYY-MM-DD-resumen.md`
con este formato:

### [HH:MM] - [Tarea breve]
- Comandos clave (resumen, no copy-paste literal)
- Archivos tocados
- Resultado: OK / warning / error con detalles
- Decisiones tomadas + razón

El propósito es trazabilidad y diario operativo. NO es para registrar cada
bash ejecutado — solo hitos. Si no estás seguro de si algo merece entrada,
NO la añadas.

Ejemplo de entrada que SÍ merece:
- "Aplicada migración 009_isin_chains, 6 backfills creados"
- "Decisión: cast en boundary en lugar de tipar createServerClient"

Ejemplo de entrada que NO merece:
- "git status ejecutado"
- "Leí ClientDashboard.tsx para entender estructura"
