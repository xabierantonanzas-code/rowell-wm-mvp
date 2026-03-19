# ROWELL PATRIMONIOS — MVP2 BRIEFING COMPLETO PARA CLAUDE CODE

> **INSTRUCCIÓN PRINCIPAL:** Lee este documento COMPLETO antes de escribir una sola línea de código.
> Contiene todo el contexto de negocio, requisitos del cliente, estructura de datos, y decisiones técnicas acumuladas en semanas de conversaciones.

---

## 1. CONTEXTO DEL NEGOCIO

### ¿Qué es Rowell Patrimonios?
Empresa de asesoramiento patrimonial independiente en España (agente financiero bajo Mapfre). Dirigida por Edgard, que gestiona ~120-150 clientes actualmente.

### El problema que resolvemos
Edgard dedica 2-3 horas POR CLIENTE para generar informes manuales con Excel. Con 150 clientes, eso son 300-450 horas/año solo en reporting. No puede escalar, no puede atender clientes premium rápidamente, y pierde oportunidades.

**Ejemplo real:** Una influencer (Gemita) pidió planificación financiera y Edgard tardó una semana en responder porque estaba desbordado. Un futbolista del Chelsea cerró una compra de €2.5M en Mallorca — Edgard necesita herramientas para ese nivel de cliente.

### Objetivos de escalado
- **Ahora:** 120-150 clientes
- **2 años:** 400 clientes (incluye comprar carteras de otros agentes)
- **Largo plazo:** 1.000 clientes con equipo

### Lo que Edgard quiere ver en 2-3 meses
Algo funcional que pueda enseñar a sus TOP 10 clientes. No tiene que estar completo, pero sí real y profesional.

### Feedback de Edgard sobre MVP1
- "Está guay" — le gusta como primer paso
- Entiende que es prototipo con datos inventados
- Quiere ver datos reales de Mapfre como siguiente paso
- Preocupado por escalabilidad ("cuando esto sea 30 veces más complejo")
- Quiere poder filtrar por AÑO (2023, 2024, 2025)
- Necesita sub-cuentas por cliente (múltiples carteras)
- "Los inversores son muy pesados y complicados, cada uno quiere ver cosas distintas"

---

## 2. STACK TECNOLÓGICO (DECIDIDO - NO CAMBIAR)

Tras evaluación formal de Power BI, Looker Studio y Next.js Custom (ver presentación comparativa), la decisión es:

- **Frontend:** Next.js 14+ con App Router, React, TypeScript, Tailwind CSS
- **Backend/DB:** Supabase Pro (€25/mes) — PostgreSQL con Row Level Security
- **Gráficos:** Recharts
- **Hosting:** Vercel (gratis → luego dominio rowell.com)
- **Auth:** Supabase Auth (email/password, JWT, roles)
- **Coste total:** ~€50-75/mes vs €750+/mes de Power BI

### Branding Rowell
- Navy: #1e3a5f
- Gold: #c9a94e
- Light background: #f5f3ee
- Dark: #0f1f33
- Tipografía body: Inter
- Tipografía headers: Playfair Display

### MVP1 completado (commit 3b25ba8)
Dashboard demo en rowell-wm-mvp.vercel.app/dashboard con 4 clientes mock, KPIs clickeables, modales, tabla de posiciones, gráfico evolución patrimonial.

---

## 3. QUÉ CONSTRUIR EN MVP2

### Objetivo
Reemplazar datos mock por datos reales de Mapfre, añadir autenticación, y que Edgard pueda subir archivos Excel y ver dashboards con datos de sus clientes reales.

### Funcionalidades MVP2 (en orden de prioridad)

1. **Supabase setup** — Crear proyecto, tablas, RLS policies
2. **Auth** — Login con email/password. Dos roles: admin (Edgard, ve todo) y client (ve solo sus datos)
3. **Parser de Excel Mapfre** — Upload de archivos, parseo automático, inserción en DB
4. **Dashboard con datos reales** — Conectar los componentes existentes a Supabase
5. **Selector de año** — Filtrar todo por 2023/2024/2025/2026
6. **Selector de cartera** — Un cliente puede tener múltiples cuentas/carteras
7. **Panel admin** — Edgard ve todos los clientes con buscador por nombre/DNI

---

## ESTRUCTURA DE LOS ARCHIVOS MAPFRE

Edgard descarga 3 tipos de archivo de Mapfre cada mes. Los 5 archivos están en la carpeta del proyecto.

### 1. Posiciones (26_01_Pos.xlsx, 26_xx_xx_Pos.xlsx)
**Sheet:** "Consulta masiva Posiciones"
**Fila 1:** Título "Consulta Masiva Posiciones"
**Fila 2:** Filtros "Oficina: 5784; Vendedor: 88897..."
**Fila 3:** HEADERS (empezar a parsear desde aquí)
**Fila 4+:** DATOS

**Columnas relevantes (0-indexed):**
| Índice | Header | Descripción | Ejemplo |
|--------|--------|-------------|---------|
| 0 | FECHA | Fecha del extracto | 31-01-2026 |
| 1 | CUENTA DE VALORES | ID único de cartera/cliente | 35635784100100211641 |
| 2 | ISIN | Código internacional del fondo | LU0187079347 |
| 3 | NOMBRE PRODUCTO | Nombre del fondo | ROBECO GLOBAL CONSUMER TRENDS EQ D EUR |
| 4 | DESCRIPCIÓN GESTORA | Gestora del fondo | ROBECO ASSET MANAGEMENT |
| 6 | DIVISA | Moneda | EUR, USD |
| 8 | TOTAL TITULOS | Participaciones | 11.2318 |
| 10 | COSTE MEDIO POSICIÓN | Precio de compra medio | 351.91 |
| 11 | PRECIO MERCADO | Precio actual | 376.62 |
| 12 | POSICION | Valoración actual en EUR | 4230.12 |
| 13 | FECHA COTIZACION | Fecha del precio | 29-01-2026 |
| 14 | CAMBIO EUR | Tipo de cambio a EUR | 1.0 (EUR) / 0.8439 (USD) |
| 15 | FECHA VALOR | Fecha compra original | 06-04-2021 |
| 20 | APELLIDOS | Siempre "ROWELL WEALTH MANAGEMENT SL" | — |
| 22 | CIF/NIF | Siempre "B22550586" | — |

**IMPORTANTE:** Todos los registros aparecen bajo la entidad "ROWELL WEALTH MANAGEMENT SL". La CUENTA DE VALORES es lo que identifica a cada cliente/cartera. Hay 139 cuentas únicas = 139 carteras. Un mismo cliente puede tener múltiples cuentas.

**Datos disponibles:** Enero 2026 (977 filas) y Febrero 2026 (979 filas).

### 2. Saldos (26_01_Saldo.xlsx, 26_xx_xx_Saldo.xlsx)
**Sheet:** "Consulta masiva saldos"
**Estructura:** Igual (fila 1=título, fila 2=filtros, fila 3=headers, fila 4+=datos)

**Columnas relevantes:**
| Índice | Header | Descripción | Ejemplo |
|--------|--------|-------------|---------|
| 0 | FECHA | Fecha del extracto | 31-01-2026 |
| 1 | CUENTA DE EFECTIVO | ID cuenta efectivo | 35635784190900168834 |
| 2 | DIVISA | EUR | EUR |
| 3 | SALDO | Importe en cuenta | 0.33 |
| 4 | SIGNO | Positivo/Negativo | + |

**201 cuentas de efectivo.** La mayoría con saldo 0. Mapear cuentas de efectivo a cuentas de valores (mismo cliente) por la parte central del número de cuenta.

### 3. Registro de Operaciones (Registro_Operaciones.xlsx)
**Sheet:** "Consulta masiva Operaciones"
**9.942 operaciones** desde enero 2021 hasta la fecha.

**Columnas relevantes:**
| Índice | Header | Descripción | Ejemplo |
|--------|--------|-------------|---------|
| 0 | NUMERO OPERACION | ID único | 4224285 |
| 3 | TIPO DE OPERACION IB | Tipo | SUSCRIPCIÓN FONDOS INVERSIÓN |
| 7 | CODIGO ISIN | ISIN del fondo | LU0823414635 |
| 8 | NOMBRE PRODUCTO | Nombre | PARVEST ENERGY TRANSITION |
| 12 | CUENTA VALORES CLIENTE | Cuenta del cliente | 35635784100100198941 |
| 14 | FECHA DE CONTRATACION | Fecha | 05-01-2021 |
| 18 | DIVISA | EUR/USD | EUR |
| 19 | NUMERO DE TITULOS | Participaciones | 1.984 |
| 21 | EFECTIVO BRUTO | Importe bruto | 2499.64 |
| 22 | EFECTIVO NETO | Importe neto | 2499.64 |
| 23 | CAMBIO DE LA DIVISA | Tipo cambio | 1 |
| 24 | CONTRAVALOR EFECTIVO NETO | En EUR | 2499.64 |
| 26 | IMPORTE RETENCION | Retenciones | 389.80 |
| 28 | IMPORTE COMISIÓN | Comisiones | 0 |

**Tipos de operación encontrados:**
- SUSCRIPCIÓN FONDOS INVERSIÓN (compra)
- REEMBOLSO FONDO INVERSIÓN (venta)
- REEMBOLSO POR TRASPASO EXT/INT (traspaso saliente)
- SUSC.TRASPASO EXT/INT (traspaso entrante)
- COMPRA/VENTA RV CONTADO (renta variable)
- REEMBOLSO POR FUSION, SUSCRIPCION POR FUSION
- SPLIT/CONTRASPLIT, LIQUIDACION IICS
- COMPRA SICAVS, AJUSTE PARTICIP

---

## SCHEMA DE BASE DE DATOS (Supabase)

```sql
-- Tabla de clientes (Edgard la rellena manualmente o via import)
-- NECESARIO: Edgard debe proporcionar mapeo cuenta -> nombre cliente
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cif TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  advisor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cuentas de valores (una cuenta = una cartera)
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  account_number TEXT UNIQUE NOT NULL,  -- ej: 35635784100100211641
  account_type TEXT DEFAULT 'valores',  -- valores / efectivo
  label TEXT,  -- nombre descriptivo ej: "Cartera Conservadora"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Posiciones (snapshot mensual)
CREATE TABLE positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  isin TEXT NOT NULL,
  product_name TEXT,
  manager TEXT,  -- gestora
  currency TEXT DEFAULT 'EUR',
  units DECIMAL,
  avg_cost DECIMAL,
  market_price DECIMAL,
  position_value DECIMAL,  -- valoración en EUR
  fx_rate DECIMAL DEFAULT 1.0,
  purchase_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, snapshot_date, isin)
);

-- Saldos de efectivo
CREATE TABLE cash_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  cash_account_number TEXT,
  currency TEXT DEFAULT 'EUR',
  balance DECIMAL DEFAULT 0,
  sign TEXT DEFAULT '+',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Operaciones históricas
CREATE TABLE operations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  operation_number TEXT,
  operation_type TEXT NOT NULL,
  isin TEXT,
  product_name TEXT,
  operation_date DATE,
  settlement_date DATE,
  currency TEXT DEFAULT 'EUR',
  units DECIMAL,
  gross_amount DECIMAL,
  net_amount DECIMAL,
  fx_rate DECIMAL DEFAULT 1.0,
  eur_amount DECIMAL,  -- contravalor en EUR
  withholding DECIMAL DEFAULT 0,
  commission DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Uploads (registro de archivos subidos)
CREATE TABLE uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID REFERENCES auth.users(id),
  file_name TEXT,
  file_type TEXT,  -- 'positions' | 'balances' | 'operations'
  snapshot_date DATE,
  rows_processed INT,
  status TEXT DEFAULT 'pending',  -- pending | processing | completed | error
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICIES
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

-- Admin (Edgard) ve todo
CREATE POLICY "admin_all" ON clients FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Cliente solo ve sus datos
CREATE POLICY "client_own" ON clients FOR SELECT
  USING (email = auth.jwt() ->> 'email');

-- Accounts: admin ve todo, cliente solo las suyas
CREATE POLICY "admin_accounts" ON accounts FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "client_accounts" ON accounts FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'));

-- Positions/Operations: heredan de accounts
CREATE POLICY "admin_positions" ON positions FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "client_positions" ON positions FOR SELECT
  USING (account_id IN (
    SELECT a.id FROM accounts a
    JOIN clients c ON a.client_id = c.id
    WHERE c.email = auth.jwt() ->> 'email'
  ));
-- (Repetir patrón para cash_balances y operations)
```

---

## DISEÑO DEL DASHBOARD

### Vista Admin (Edgard)
- **Panel principal:** Lista/buscador de todos los clientes con patrimonio total
- **Upload zone:** Drag & drop para subir los 3 archivos Mapfre
- **Por cliente:** Click → dashboard completo del cliente
- **KPIs globales:** AUM total, nº clientes, crecimiento mensual

### Vista Cliente
- **Sus KPIs:** Patrimonio total, rendimiento, nº fondos
- **Selector de cartera:** Si tiene múltiples cuentas, dropdown para seleccionar
- **Tabla posiciones:** Todos los fondos con ISIN, nombre, títulos, coste, precio actual, P&L
- **Gráfico evolución:** Línea con patrimonio mes a mes (datos de snapshots)
- **Distribución:** Pie chart por gestora o por tipo de activo

### Branding Rowell
- Colores: Navy #1e3a5f, Gold #c9a94e, Light bg #f5f3ee, Dark #0f1f33
- Tipografía: Inter para body, Playfair Display para headers
- Logo en sidebar/header

---

## NOTA CRÍTICA: MAPEO CUENTA → CLIENTE

Los archivos Mapfre NO contienen el nombre individual de cada cliente. Todo aparece bajo "ROWELL WEALTH MANAGEMENT SL". La CUENTA DE VALORES (ej: 35635784100100211641) es el único identificador por cartera.

**Edgard necesita proporcionar un mapeo:** número de cuenta → nombre del cliente. Sin esto:
1. Usar las cuentas como IDs temporales (mostrar "Cuenta ...1641" en vez de "Juan García")
2. Crear una interfaz donde Edgard pueda asignar nombres a cada cuenta manualmente

**Recomendación:** Empezar con opción 1 + crear interfaz de mapeo. No bloquear desarrollo por esto.

---

## ARCHIVOS MAPFRE DISPONIBLES

Copiar estos archivos a `/data/mapfre/` en el proyecto:
- `26_01_Pos.xlsx` — Posiciones enero 2026 (977 filas, 139 cuentas)
- `26_01_Saldo.xlsx` — Saldos enero 2026 (201 cuentas)
- `26_xx_xx_Pos.xlsx` — Posiciones febrero 2026 (979 filas)
- `26_xx_xx_Saldo.xlsx` — Saldos febrero 2026
- `Registro_Operaciones.xlsx` — Historial 2021-2026 (9.942 operaciones)

---

## EL EXCEL DE EDGARD: MR_v30_exempleL.xlsm (27 HOJAS)

Este es el "cerebro" actual de Edgard. Un Excel de 21MB con macros que usa para generar informes manualmente. Tiene 27 hojas:

### Hojas clave para entender el negocio:

1. **Info_Inversor** (263 filas x 79 cols) — Datos del cliente recogidos en entrevista: perfil de riesgo, horizonte temporal, situación familiar, ingresos, gastos, patrimonio. Es el formulario de ~30-40 preguntas que Edgard rellena con cada cliente.

2. **CashFlows** (219 filas x 103 cols) — Motor de cálculo financiero. Proyecciones año a año (2025, 2026, 2027...) con edad, ingresos, gastos, ahorro, inversión. Es la pieza MÁS COMPLEJA del sistema y la que más valor aporta.

3. **OUTPUT** (97 filas x 149 cols) — Datos calculados para las tablas y gráficos del informe.

4. **Portfolio** (71 filas x 55 cols) — Composición de cartera de inversión.

5. **ProdInv** (59 filas x 45 cols) — Productos de inversión disponibles.

6. **Hipoteca1/2/3** — Simuladores de hipoteca para hasta 3 propiedades.

7. **DBoard_V / DBoard_H** — Dashboards verticales y horizontales (lo que queremos replicar en web).

8. **Portada, pag1-pag12** — Las 16 páginas del informe PDF que se genera para cada cliente.

### El informe que se genera (tipo "Joan García")
Es un PDF de 16 páginas que incluye:
- Datos personales y situación financiera
- Análisis de riesgo
- Propuesta de inversión con 3 escenarios
- Proyección de CashFlows a 30+ años
- Composición de cartera recomendada
- Gráficos de evolución patrimonial

**PARA MVP2:** NO replicar el motor CashFlows ni la generación PDF todavía. Eso es Fase 2-3. MVP2 se centra en datos reales de Mapfre + dashboards + auth.

---

## VISIÓN COMPLETA DE LA PLATAFORMA (FASES)

### Fase 1 — MVP2 (AHORA, 2-3 semanas)
- Auth + roles (admin/cliente)
- Upload y parseo de archivos Mapfre
- Dashboard con datos reales
- Selectores de año y cartera
- Panel admin con buscador de clientes

### Fase 2 — Motor de valor (semanas 4-8)
- Formulario digital que reemplaza Info_Inversor
- Motor de cálculo que replica CashFlows
- Generación automática del informe PDF (16 páginas)

### Fase 3 — Plataforma completa (semanas 8-12)
- Patrimonio no gestionado (inmuebles, participaciones)
- Portal de documentos por cliente
- Simulador de hipotecas
- Portfolio X-Ray (análisis de cartera)
- AUM tracking y previsión de remuneración

### Fase 4 — Multi-gestor (semanas 12+)
- Vender la plataforma a otros gestores patrimoniales
- Modelo SaaS: €99-149/mes por gestor
- Onboarding self-service

---

## SEGURIDAD (EDGARD LO HA PREGUNTADO EXPLÍCITAMENTE)

La seguridad de datos financieros es una preocupación real de Edgard. Implementar:

- **Supabase Auth:** JWT firmados, refresh tokens, protección brute force, MFA opcional
- **Row Level Security (RLS):** Nativa en PostgreSQL, cada cliente SOLO ve sus datos
- **Cifrado en tránsito:** TLS/SSL (HTTPS) automático con Vercel
- **Cifrado en reposo:** AES-256 en Supabase
- **Sesiones:** Expiración automática, revocables
- **Archivos:** Storage de Supabase con permisos por carpeta-cliente
- **Plan Pro:** Suficiente para arrancar. SOC2 disponible en Team (€599/mes) cuando haya clientes institucionales

---

## INSTRUCCIONES PARA CLAUDE CODE

1. **Lee este briefing COMPLETO** antes de empezar
2. **Analiza los 5 archivos Excel** de Mapfre para confirmar la estructura
3. **Pide al usuario** las credenciales de Supabase (URL + anon key + service role key)
4. **Crea el schema** de base de datos con las tablas y RLS policies
5. **Construye el parser** de Excel (usa la librería xlsx/SheetJS en TypeScript)
6. **Implementa auth** con Supabase Auth (crear usuario admin para Edgard)
7. **Conecta el dashboard** existente a datos reales de Supabase
8. **Añade upload** de archivos con drag & drop
9. **Implementa selectores** de año y cartera
10. **Panel admin** con lista de clientes/cuentas y buscador
11. **Haz commits frecuentes** con mensajes descriptivos en español
12. **Testea RLS:** admin ve todo, cliente solo ve lo suyo

### Prioridad absoluta
El resultado debe ser algo que Edgard pueda enseñar a sus top 10 clientes en 2-3 meses. Profesional, con branding Rowell, datos reales. No tiene que estar completo, pero lo que haya tiene que funcionar perfectamente.
