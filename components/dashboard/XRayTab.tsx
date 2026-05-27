/**
 * XRayTab — Análisis look-through de la cartera del cliente.
 *
 * MVP7 Fase F1 (scaffold inicial).
 *
 * Estado: PLACEHOLDER con datos hardcoded del Ejemplo_XRay_1.pdf que envió
 * Edgard. Sin queries reales contra Supabase ni cross-repo a `funds_universe`.
 * Eso entra en F2-F4 (ver docs/specs/XRAY_SPEC.md).
 *
 * Cuando F2 esté disponible (migración mvp7_001 aplicada + lib/queries/funds.ts),
 * este componente recibirá `xrayData: XRayAggregation` como prop en lugar de
 * tener los datos hardcoded. Las sub-secciones (DistribucionActivos, etc.) ya
 * están parametrizadas para aceptar los datos por props — solo hay que cambiar
 * la fuente.
 *
 * Validación visual contra:
 *  - data/raw data folder/WM Platform-5/Ejemplo_XRay_1.pdf (cartera RV pura)
 *  - data/raw data folder/WM Platform-5/Ejemplo_XRay_2.pdf (cartera con Asia
 *    emergente)
 */

"use client";

import { useEffect, useState } from "react";

// =============================================================================
// Datos del Ejemplo 1 (placeholder — hardcoded de Ejemplo_XRay_1.pdf)
// =============================================================================

type FundRow = {
  isin?: string;
  nombre: string;
  pesoPct: number;
  rent3yAnual: number;
  vol: number;
};

type DistribucionActivos = {
  categoria: string;
  largo: number;
  corto: number;
  patrimonio: number;
};

type RegionRow = {
  nombre: string;
  pct: number;
};

type RegionGroup = {
  titulo: string;
  totalPct: number;
  subregiones: RegionRow[];
};

type SectorRow = {
  nombre: string;
  pct: number;
};

type SectorGroup = {
  super: "Cíclico" | "Sensible al ciclo" | "Defensivo";
  totalPct: number;
  sectores: SectorRow[];
};

type HoldingRow = {
  pctActivos: number;
  nombre: string;
  tipo: string;
  sector: string;
  pais: string;
};

const EJEMPLO_1_FUNDS: FundRow[] = [
  { nombre: "BGF World Technology A2 EUR", pesoPct: 20.0, rent3yAnual: 30.12, vol: 26.08 },
  { nombre: "Brandes US Value A Euro", pesoPct: 20.0, rent3yAnual: 13.04, vol: 12.82 },
  { nombre: "Eleva European Selection A2 EUR acc", pesoPct: 20.0, rent3yAnual: 11.84, vol: 12.0 },
  { nombre: "GS US CORE Equity E Acc EUR", pesoPct: 20.0, rent3yAnual: 17.14, vol: 14.99 },
  { nombre: "T. Rowe Price US Smlr Cm Eq A (EUR)", pesoPct: 20.0, rent3yAnual: 9.03, vol: 16.45 },
];

const EJEMPLO_1_DISTRIBUCION: DistribucionActivos[] = [
  { categoria: "Acciones", largo: 98.38, corto: 0.0, patrimonio: 98.38 },
  { categoria: "Obligaciones", largo: 0.0, corto: 0.0, patrimonio: 0.0 },
  { categoria: "Efectivo", largo: 3.42, corto: 2.34, patrimonio: 1.08 },
  { categoria: "Otro", largo: 0.54, corto: 0.0, patrimonio: 0.54 },
  { categoria: "No clasificado", largo: 0.0, corto: 0.0, patrimonio: 0.0 },
];

const EJEMPLO_1_REGIONES: RegionGroup[] = [
  {
    titulo: "Europa/O. Medio/Africa",
    totalPct: 20.48,
    subregiones: [
      { nombre: "Reino Unido", pct: 4.46 },
      { nombre: "Europa Occidental - Euro", pct: 12.61 },
      { nombre: "Europa Occidental - No Euro", pct: 3.39 },
      { nombre: "Europa Emergente", pct: 0.0 },
      { nombre: "Oriente Medio / África", pct: 0.02 },
    ],
  },
  {
    titulo: "América",
    totalPct: 75.05,
    subregiones: [
      { nombre: "Estados Unidos", pct: 73.22 },
      { nombre: "Canadá", pct: 1.36 },
      { nombre: "América Latina y Centroamérica", pct: 0.47 },
    ],
  },
  {
    titulo: "Asia",
    totalPct: 4.47,
    subregiones: [
      { nombre: "Japón", pct: 0.69 },
      { nombre: "Australasia", pct: 0.05 },
      { nombre: "Los 4 tigres", pct: 3.64 },
      { nombre: "Asia Emergente - Ex. 4 tigres", pct: 0.09 },
    ],
  },
];

const EJEMPLO_1_SECTORES: SectorGroup[] = [
  {
    super: "Cíclico",
    totalPct: 25.97,
    sectores: [
      { nombre: "Materiales Básicos", pct: 4.12 },
      { nombre: "Consumo Cíclico", pct: 6.69 },
      { nombre: "Servicios Financieros", pct: 14.03 },
      { nombre: "Inmobiliario", pct: 1.13 },
    ],
  },
  {
    super: "Sensible al ciclo",
    totalPct: 53.96,
    sectores: [
      { nombre: "Servicios de Comunicación", pct: 6.21 },
      { nombre: "Energía", pct: 5.35 },
      { nombre: "Industria", pct: 13.71 },
      { nombre: "Tecnología", pct: 28.68 },
    ],
  },
  {
    super: "Defensivo",
    totalPct: 19.82,
    sectores: [
      { nombre: "Consumo Defensivo", pct: 3.59 },
      { nombre: "Salud", pct: 13.52 },
      { nombre: "Servicios Públicos", pct: 2.71 },
    ],
  },
];

const EJEMPLO_1_HOLDINGS: HoldingRow[] = [
  { pctActivos: 3.41, nombre: "NVIDIA Corp", tipo: "Acción", sector: "Tecnología", pais: "Estados Unidos" },
  { pctActivos: 2.85, nombre: "Apple Inc", tipo: "Acción", sector: "Tecnología", pais: "Estados Unidos" },
  { pctActivos: 2.28, nombre: "Broadcom Inc", tipo: "Acción", sector: "Tecnología", pais: "Estados Unidos" },
  { pctActivos: 2.2, nombre: "Microsoft Corp", tipo: "Acción", sector: "Tecnología", pais: "Estados Unidos" },
  { pctActivos: 1.1, nombre: "Alphabet Inc Class C", tipo: "Acción", sector: "Servicios de Comunicación", pais: "Estados Unidos" },
  { pctActivos: 1.09, nombre: "Alphabet Inc Class A", tipo: "Acción", sector: "Servicios de Comunicación", pais: "Estados Unidos" },
  { pctActivos: 1.02, nombre: "Taiwan Semiconductor Manufacturing Co Ltd ADR", tipo: "Acción", sector: "Tecnología", pais: "Taiwán" },
  { pctActivos: 0.91, nombre: "Lam Research Corp", tipo: "Acción", sector: "Tecnología", pais: "Estados Unidos" },
  { pctActivos: 0.86, nombre: "ASML Holding NV", tipo: "Acción", sector: "Tecnología", pais: "Holanda" },
  { pctActivos: 0.79, nombre: "SK Hynix Inc", tipo: "Acción", sector: "Tecnología", pais: "Corea" },
];

// =============================================================================
// Helpers
// =============================================================================

// Formateadores deterministas: NO usar toLocaleString aquí.
// Razón: toLocaleString depende del build de ICU en Node, y puede formatear
// distinto en server (Node con ICU minimal) y client (browser con ICU
// completo), lo que rompe la hidratación de React. Estos helpers producen
// siempre el mismo string en ambos lados.

function tieneRentaFija(rows: DistribucionActivos[]): boolean {
  const oblig = rows.find((r) => r.categoria === "Obligaciones");
  return !!oblig && oblig.patrimonio > 0;
}

function num(n: number): string {
  const fixed = n.toFixed(2); // "1234.56" o "-1234.56"
  const negative = fixed.startsWith("-");
  const abs = negative ? fixed.slice(1) : fixed;
  const [intPart, decPart] = abs.split(".");
  // separador de miles "." cada 3 dígitos
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${withThousands},${decPart}`;
}

function pct(n: number): string {
  return num(n) + "%";
}

// =============================================================================
// Helpers visuales (SVG donut + barras apiladas, sin libs externas)
// =============================================================================

type DonutSegment = { label: string; value: number; color: string };

function DonutChart({
  segments,
  size = 160,
  thickness = 24,
  centerLabel,
  centerValue,
  animateIn = true,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  animateIn?: boolean;
}) {
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((seg, i) => {
      const fraction = total > 0 ? seg.value / total : 0;
      const length = fraction * circumference;
      // animateIn=false: dash inicial "0 cir" (sin pintar)
      // animateIn=true: dash final "length (cir-length)" (segmento real)
      const dashArray = animateIn
        ? `${length} ${circumference - length}`
        : `0 ${circumference}`;
      const dashOffset = -offset;
      offset += length;
      return (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={thickness}
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            transition: "stroke-dasharray 1350ms cubic-bezier(0.4, 0, 0.2, 1)",
            transitionDelay: `${i * 120}ms`,
          }}
        />
      );
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={thickness} />
      {arcs}
      {(centerLabel || centerValue) && (
        <g>
          {centerValue && (
            <text x={cx} y={cy - 4} textAnchor="middle" className="fill-[var(--color-primary)] text-base font-bold">
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text x={cx} y={cy + 14} textAnchor="middle" className="fill-gray-500 text-[10px]">
              {centerLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

type StackedSegment = { label: string; value: number; color: string };

function StackedBar({
  segments,
  totalLabel,
  height = 14,
  animateIn = true,
}: {
  segments: StackedSegment[];
  totalLabel?: string;
  height?: number;
  animateIn?: boolean;
}) {
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  return (
    <div>
      <div
        className="flex w-full overflow-hidden rounded-full bg-gray-100"
        style={{ height: `${height}px` }}
      >
        {segments
          .filter((s) => s.value > 0)
          .map((seg, i) => (
            <div
              key={i}
              title={`${seg.label}: ${num(seg.value)}%`}
              style={{
                width: animateIn && total > 0
                  ? `${(seg.value / total) * 100}%`
                  : "0%",
                backgroundColor: seg.color,
                transition: "width 1200ms cubic-bezier(0.4, 0, 0.2, 1)",
                transitionDelay: `${i * 150}ms`,
              }}
            />
          ))}
      </div>
      {totalLabel && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
          <span>{totalLabel}</span>
          <span className="tabular-nums">{num(total)}%</span>
        </div>
      )}
    </div>
  );
}

function HBarRow({
  label,
  value,
  maxValue,
  color,
  animateIn = true,
  delayMs = 0,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  animateIn?: boolean;
  delayMs?: number;
}) {
  const widthPct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 py-0.5">
      <div className="min-w-0">
        <div className="mb-0.5 flex items-baseline justify-between text-xs">
          <span className="truncate text-gray-700">{label}</span>
          <span className="ml-2 tabular-nums text-gray-900">{num(value)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full"
            style={{
              width: animateIn ? `${widthPct}%` : "0%",
              backgroundColor: color,
              transition: "width 1050ms cubic-bezier(0.4, 0, 0.2, 1)",
              transitionDelay: `${delayMs}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Paleta consistente entre todos los bloques
const ACTIVO_COLORS: Record<string, string> = {
  Acciones: "#3D4F63",      // primary
  Obligaciones: "#B8965A",  // gold
  Efectivo: "#94A3B8",      // slate-400
  Otro: "#F59E0B",          // amber-500
  "No clasificado": "#E5E7EB", // gray-200
};

const REGION_COLORS: Record<string, string> = {
  "Europa/O. Medio/Africa": "#3D4F63",
  "América": "#B8965A",
  "Asia": "#0E7490", // cyan-700
};

const SUPERSECTOR_COLORS: Record<string, string> = {
  "Cíclico": "#F59E0B",          // amber
  "Sensible al ciclo": "#3B82F6", // blue
  "Defensivo": "#10B981",         // emerald
};

// =============================================================================
// Sub-componentes
// =============================================================================

function FundsHeader({ funds, animateIn = true }: { funds: FundRow[]; animateIn?: boolean }) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-[var(--color-table-header-bg)] text-xs uppercase text-[var(--color-table-header-text)]">
            <th className="w-12 px-3 py-2.5 font-medium">#</th>
            <th className="px-3 py-2.5 font-medium">Nombre</th>
            <th className="px-3 py-2.5 text-right font-medium">Peso (%)</th>
            <th className="px-3 py-2.5 text-right font-medium">3 Años Anualizado</th>
            <th className="px-3 py-2.5 text-right font-medium">Vol.</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((f, i) => (
            <tr
              key={f.nombre}
              className="border-b border-gray-100 last:border-0 hover:bg-[var(--color-bg)]"
              style={{
                opacity: animateIn ? 1 : 0,
                transform: animateIn ? "translateY(0)" : "translateY(6px)",
                transition: "opacity 750ms ease-out, transform 750ms ease-out",
                transitionDelay: `${i * 90}ms`,
              }}
            >
              <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
              <td className="px-3 py-2 text-xs font-medium">{f.nombre}</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">{num(f.pesoPct)}</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">{num(f.rent3yAnual)}</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">{num(f.vol)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DistribucionActivosBlock({ rows, animateIn = true }: { rows: DistribucionActivos[]; animateIn?: boolean }) {
  const segments: DonutSegment[] = rows
    .filter((r) => r.patrimonio > 0)
    .map((r) => ({
      label: r.categoria,
      value: r.patrimonio,
      color: ACTIVO_COLORS[r.categoria] ?? "#9CA3AF",
    }));
  const totalPatrimonio = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
        Distribución de Activos
      </h3>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <DonutChart
          segments={segments}
          size={160}
          thickness={26}
          centerLabel="Patrimonio"
          centerValue={`${num(totalPatrimonio)}%`}
          animateIn={animateIn}
        />
        <div className="w-full flex-1 space-y-1.5">
          {rows.map((r) => (
            <div key={r.categoria} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ACTIVO_COLORS[r.categoria] ?? "#9CA3AF" }}
              />
              <span className="flex-1 truncate text-gray-700">{r.categoria}</span>
              <span className="tabular-nums font-medium text-gray-900">{num(r.patrimonio)}%</span>
            </div>
          ))}
        </div>
      </div>
      <table className="mt-4 w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-1.5 font-medium">Categoría</th>
            <th className="py-1.5 text-right font-medium">Largo</th>
            <th className="py-1.5 text-right font-medium">Corto</th>
            <th className="py-1.5 text-right font-medium">Patrimonio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.categoria} className="border-b border-gray-100 last:border-0">
              <td className="py-1.5">{r.categoria}</td>
              <td className="py-1.5 text-right tabular-nums">{num(r.largo)}</td>
              <td className="py-1.5 text-right tabular-nums">{num(r.corto)}</td>
              <td className="py-1.5 text-right tabular-nums font-medium">{num(r.patrimonio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RangoVencimientosBlock() {
  const buckets = ["1 a 3", "3 a 5", "5 a 7", "7 a 10", "10 a 15", "15 a 20", "20 a 30", "Más de 30"];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
        Rango de vencimientos (Renta Fija)
      </h3>
      <table className="w-full text-left text-xs">
        <tbody>
          {buckets.map((b) => (
            <tr key={b} className="border-b border-gray-100 last:border-0">
              <td className="py-1.5 text-gray-700">{b}</td>
              <td className="py-1.5 text-right text-gray-400">—</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs italic text-gray-400">
        Cartera ejemplo es 100% RV — sin vencimientos
      </p>
    </div>
  );
}

function DesgloseRegionesBlock({ grupos, animateIn = true }: { grupos: RegionGroup[]; animateIn?: boolean }) {
  // barra apilada con totales por gran región (Europa/América/Asia)
  const stackedSegments: StackedSegment[] = grupos.map((g) => ({
    label: g.titulo,
    value: g.totalPct,
    color: REGION_COLORS[g.titulo] ?? "#9CA3AF",
  }));
  // máximo entre todas las sub-regiones, para escalar las HBarRow consistentemente
  const maxSubregion = Math.max(
    1,
    ...grupos.flatMap((g) => g.subregiones.map((sr) => sr.pct))
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-primary)]">Desglose por regiones</h3>
        <span className="text-xs text-gray-500">Solo activos accionarios</span>
      </div>

      {/* Barra apilada total */}
      <div className="mb-2">
        <StackedBar segments={stackedSegments} height={16} animateIn={animateIn} />
      </div>
      <div className="mb-5 flex flex-wrap gap-3 text-[11px] text-gray-600">
        {stackedSegments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
            <span className="tabular-nums font-medium text-gray-900">{num(s.value)}%</span>
          </span>
        ))}
      </div>

      {/* Sub-regiones en 3 columnas con barras */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {grupos.map((g, gi) => {
          const color = REGION_COLORS[g.titulo] ?? "#9CA3AF";
          return (
            <div key={g.titulo}>
              <div className="mb-2 flex items-baseline justify-between border-b border-gray-200 pb-1">
                <span className="text-xs font-semibold text-gray-700">{g.titulo}</span>
                <span className="text-sm font-bold tabular-nums text-[var(--color-primary)]">
                  {num(g.totalPct)}%
                </span>
              </div>
              <div className="space-y-0.5">
                {g.subregiones.map((sr, sri) => (
                  <HBarRow
                    key={sr.nombre}
                    label={sr.nombre}
                    value={sr.pct}
                    maxValue={maxSubregion}
                    color={color}
                    animateIn={animateIn}
                    delayMs={600 + gi * 120 + sri * 75}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectoresRVBlock({ grupos, animateIn = true }: { grupos: SectorGroup[]; animateIn?: boolean }) {
  const bgMap: Record<string, string> = {
    "Cíclico": "bg-amber-50",
    "Sensible al ciclo": "bg-blue-50",
    "Defensivo": "bg-emerald-50",
  };
  const stackedSegments: StackedSegment[] = grupos.map((g) => ({
    label: g.super,
    value: g.totalPct,
    color: SUPERSECTOR_COLORS[g.super] ?? "#9CA3AF",
  }));
  const maxSector = Math.max(1, ...grupos.flatMap((g) => g.sectores.map((s) => s.pct)));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
        Sectores de Renta Variable
      </h3>

      {/* Barra apilada por super-sectores */}
      <div className="mb-2">
        <StackedBar segments={stackedSegments} height={16} animateIn={animateIn} />
      </div>
      <div className="mb-5 flex flex-wrap gap-3 text-[11px] text-gray-600">
        {stackedSegments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
            <span className="tabular-nums font-medium text-gray-900">{num(s.value)}%</span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {grupos.map((g, gi) => {
          const color = SUPERSECTOR_COLORS[g.super] ?? "#9CA3AF";
          return (
            <div key={g.super}>
              <div className={`mb-2 flex items-baseline justify-between rounded-md px-2 py-1 ${bgMap[g.super]}`}>
                <span className="text-xs font-semibold" style={{ color }}>{g.super}</span>
                <span className="text-sm font-bold tabular-nums" style={{ color }}>{num(g.totalPct)}%</span>
              </div>
              <div className="space-y-0.5">
                {g.sectores.map((s, si) => (
                  <HBarRow
                    key={s.nombre}
                    label={s.nombre}
                    value={s.pct}
                    maxValue={maxSector}
                    color={color}
                    animateIn={animateIn}
                    delayMs={600 + gi * 120 + si * 75}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopHoldingsBlock({ holdings, animateIn = true }: { holdings: HoldingRow[]; animateIn?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-[var(--color-table-header-bg)] px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase text-[var(--color-table-header-text)]">
          Las 10 principales posiciones (look-through)
        </h3>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
            <th className="px-3 py-2 text-right font-medium">Activos %</th>
            <th className="px-3 py-2 font-medium">Nombre</th>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium">Sector</th>
            <th className="px-3 py-2 font-medium">País</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => (
            <tr
              key={h.nombre}
              className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
              style={{
                opacity: animateIn ? 1 : 0,
                transform: animateIn ? "translateY(0)" : "translateY(6px)",
                transition: "opacity 675ms ease-out, transform 675ms ease-out",
                transitionDelay: `${750 + i * 75}ms`,
              }}
            >
              <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold">
                {num(h.pctActivos)}
              </td>
              <td className="px-3 py-2 text-xs font-medium">{h.nombre}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{h.tipo}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{h.sector}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{h.pais}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Componente principal
// =============================================================================

export default function XRayTab() {
  // Mount guard: server y client renderizan el mismo loading inicial.
  // animateIn dispara las animaciones de entrada un frame despues del mount,
  // para que las transiciones CSS partan desde el estado "vacio" (width 0,
  // donut sin pintar, filas con opacity 0) y se animen hasta el valor final.
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  useEffect(() => {
    setMounted(true);
    // doble RAF: garantiza que el browser pinta el estado inicial antes de
    // disparar la transicion al estado final. Sin esto, algunos browsers
    // saltan directos al final.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnimateIn(true))
    );
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-400">
        Cargando X-Ray…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FundsHeader funds={EJEMPLO_1_FUNDS} animateIn={animateIn} />

      {/* Distribución de Activos a ancho completo.
          Rango de vencimientos solo se muestra si la cartera tiene Renta Fija
          (Obligaciones > 0). En el placeholder Ejemplo 1 la cartera es 100% RV
          → ocultamos el bloque. Cuando entren datos reales con bonos, el flag
          tieneRentaFija se activará y aparecerá la tabla de buckets. */}
      <DistribucionActivosBlock rows={EJEMPLO_1_DISTRIBUCION} animateIn={animateIn} />
      {tieneRentaFija(EJEMPLO_1_DISTRIBUCION) && <RangoVencimientosBlock />}

      <DesgloseRegionesBlock grupos={EJEMPLO_1_REGIONES} animateIn={animateIn} />
      <SectoresRVBlock grupos={EJEMPLO_1_SECTORES} animateIn={animateIn} />
      <TopHoldingsBlock holdings={EJEMPLO_1_HOLDINGS} animateIn={animateIn} />
    </div>
  );
}
