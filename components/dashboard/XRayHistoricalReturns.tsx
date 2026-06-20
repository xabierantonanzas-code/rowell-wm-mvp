/**
 * XRayHistoricalReturns — "2ª página" del X-Ray: rentabilidad por año natural
 * (R29-1 / R29-2). Matriz fondo × año + fila de cartera teórica.
 *
 * Carga lazy: hace fetch a /api/xray/historical al montar (= al expandir la
 * sub-sección). Degrada con gracia:
 *   - sin posiciones / tabla funds_universe vacía / sin histórico → aviso
 *     "datos insuficientes" (no rompe el X-Ray).
 *
 * Valores en convención del pipeline (porcentaje), renderizados sin transformar.
 */

"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoricalReturnsAggregation } from "@/lib/types/xray";
import type { XRayInputPosition } from "@/components/dashboard/XRayTab";

function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)} %`;
}

function pctClass(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "text-gray-400";
  return v >= 0 ? "text-green-700" : "text-red-600";
}

type YearDatum = { year: string; rent: number | null; cobertura: number };

function ChartTooltip(props: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ payload: YearDatum }>;
}) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-gray-800">{label}</div>
      <div className={pctClass(d.rent)}>{fmtPct(d.rent)}</div>
      <div className="text-gray-400">Cobertura {Math.round(d.cobertura)} %</div>
    </div>
  );
}

export default function XRayHistoricalReturns({
  positions = [],
}: {
  positions?: XRayInputPosition[];
}) {
  const [agg, setAgg] = useState<HistoricalReturnsAggregation | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    if (positions.length === 0) {
      setLoaded(true);
      return;
    }
    fetch("/api/xray/historical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positions }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: HistoricalReturnsAggregation | null) => {
        if (!cancel) {
          setAgg(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancel) setLoaded(true);
      });
    return () => {
      cancel = true;
    };
  }, [positions]);

  if (!loaded) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-400">
        Cargando rentabilidad histórica…
      </div>
    );
  }

  const tieneDatos = !!agg && !agg.vacio && agg.years.length > 0;

  if (!tieneDatos) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Datos insuficientes para la rentabilidad histórica por año. Se mostrará
        cuando el Universo de fondos tenga la serie de años naturales de las IIC
        de esta cartera.
      </div>
    );
  }

  const a = agg!;
  const years = a.years;
  const chartData: YearDatum[] = years.map((y) => ({
    year: String(y),
    rent: a.carteraPorAnyo[y],
    cobertura: a.coberturaPorAnyo[y] ?? 0,
  }));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        La fila <strong>Cartera (teórica)</strong> indica qué habría rentado tu
        asignación actual cada año natural, ponderada por el peso de hoy. Es una
        aproximación: la composición real de años pasados pudo ser distinta.
        Cobertura global: {a.cobertura.pct.toFixed(1)} %.
      </div>

      {/* Gráfico: rentabilidad de la cartera teórica por año natural */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Cartera (teórica) — rentabilidad por año natural
        </h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="rent" radius={[3, 3, 0, 0]} maxBarSize={48}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={(d.rent ?? 0) >= 0 ? "#15803d" : "#dc2626"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-primary-50 text-primary">
              <th className="sticky left-0 z-10 bg-primary-50 px-3 py-2 text-left font-semibold">
                Fondo
              </th>
              <th className="px-3 py-2 text-right font-semibold">Peso</th>
              {years.map((y) => (
                <th key={y} className="px-3 py-2 text-right font-semibold">
                  {y}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">3A an.</th>
              <th className="px-3 py-2 text-right font-semibold">5A an.</th>
              <th className="px-3 py-2 text-right font-semibold">10A an.</th>
            </tr>
          </thead>
          <tbody>
            {a.fondos.map((f) => (
              <tr key={f.isin} className="border-b border-gray-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-gray-800">
                  {f.nombre}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {f.pesoPct.toFixed(1)} %
                </td>
                {years.map((y) => (
                  <td
                    key={y}
                    className={`px-3 py-2 text-right tabular-nums ${pctClass(
                      f.porAnyo[y]
                    )}`}
                  >
                    {fmtPct(f.porAnyo[y])}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right tabular-nums ${pctClass(f.rent3Yanual)}`}>
                  {fmtPct(f.rent3Yanual)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${pctClass(f.rent5Yanual)}`}>
                  {fmtPct(f.rent5Yanual)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${pctClass(f.rent10Yanual)}`}>
                  {fmtPct(f.rent10Yanual)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary/30 bg-gold-50 font-semibold text-primary">
              <td className="sticky left-0 z-10 bg-gold-50 px-3 py-2 text-left">
                Cartera (teórica)
              </td>
              <td className="px-3 py-2 text-right tabular-nums">100 %</td>
              {years.map((y) => (
                <td
                  key={y}
                  className={`px-3 py-2 text-right tabular-nums ${pctClass(
                    a.carteraPorAnyo[y]
                  )}`}
                  title={`Cobertura ${a.coberturaPorAnyo[y]?.toFixed(0) ?? 0} %`}
                >
                  {fmtPct(a.carteraPorAnyo[y])}
                </td>
              ))}
              <td className="px-3 py-2 text-right text-gray-400">—</td>
              <td className="px-3 py-2 text-right text-gray-400">—</td>
              <td className="px-3 py-2 text-right text-gray-400">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
