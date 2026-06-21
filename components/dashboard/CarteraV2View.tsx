"use client";

// ===========================================================================
// CarteraV2View — reproduccion fiel del prototipo wm_cartera de Edgard.
//
// Prototipo original: chart.js + grid.js. Aqui TODO con Recharts (unica libreria
// de graficos disponible en el repo) + tablas HTML nativas. La paleta, labels,
// layout y formato es-ES siguen el prototipo al pie de la letra.
//
// Calculos reutilizados de ClientDashboard / lib/returns / lib/operations-taxonomy:
//   - flowAmountEur / classifyFlow      (taxonomia PLUS/MINUS/NEUTRO)
//   - inceptionDate, simpleReturn, ...  (modelo de rentabilidades)
//   - resolveProductType / buildProductTypeMap (IIC vs RV desde 1a compra)
// ===========================================================================

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Operation, Position } from "@/lib/types/database";
import { classifyFlow, flowAmountEur } from "@/lib/operations-taxonomy";
import {
  assessTwrReliability,
  chainedTwr,
  inceptionDate,
  irrFromSignedFlows,
  periodReturns,
  returnsTimeSeries,
  simpleReturn,
  simpleReturnAnnualized,
  type Horizon,
} from "@/lib/returns";
import {
  buildProductTypeMap,
  resolveProductType,
} from "@/lib/product-type-from-ops";

// ---------------------------------------------------------------------------
// Paleta (del prototipo)
// ---------------------------------------------------------------------------
const C = {
  bg: "#f4f6f9",
  card: "#ffffff",
  ink: "#15233b",
  muted: "#64748b",
  line: "#e4e9f0",
  brand: "#0f3d6e",
  brand2: "#1b6ec2",
  gold: "#b8893a",
  iic: "#1b6ec2",
  rv: "#7e57c2",
  cash: "#94a3b8",
  otros: "#cbd5e1",
  pos: "#1f9d6b",
  neg: "#d1495b",
  capital: "#0f3d6e", // linea capital invertido
  ret: "#0f5132", // linea rentabilidad
};

const PAL = [
  "#0f3d6e",
  "#1b6ec2",
  "#7e57c2",
  "#1f9d6b",
  "#b8893a",
  "#d1495b",
  "#3aa6b9",
  "#e07a5f",
  "#8d99ae",
  "#5e548e",
  "#cbd5e1",
];

// ---------------------------------------------------------------------------
// Formato es-ES (fiel a EUR / PCT / SPCT del prototipo)
// ---------------------------------------------------------------------------
function eur(v: number | null | undefined): string {
  if (v == null) return "—";
  return (
    v.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}
function eur0(v: number | null | undefined): string {
  if (v == null) return "—";
  return Math.round(v).toLocaleString("es-ES") + " €";
}
function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (
    (v * 100).toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " %"
  );
}
function spct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (
    (v >= 0 ? "+" : "") +
    (v * 100).toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    " %"
  );
}
function num(v: number | null | undefined, maxFrac = 4): string {
  if (v == null) return "—";
  return v.toLocaleString("es-ES", { maximumFractionDigits: maxFrac });
}
function fmtDateEs(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface HistoryPoint {
  date: string;
  totalValue: number;
}

interface CarteraV2ViewProps {
  clientName: string;
  accountNumber: string;
  positions: Position[];
  history: HistoryPoint[];
  operations: Operation[];
  cashBalance: number;
  availableDateRange: { minDate: string; maxDate: string } | null;
}

type RetMetric = "simple" | "mwr" | "twr";
type HorizonKey = "SI" | "5Y" | "3Y" | "1Y" | "YTD";
type CompDim = "activo" | "tipo" | "gestora" | "divisa";

const RET_LABEL: Record<RetMetric, string> = {
  simple: "Simple",
  mwr: "MWR",
  twr: "TWR≈",
};

// ---------------------------------------------------------------------------
// UI helpers (segment buttons, line rows)
// ---------------------------------------------------------------------------
function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: `1px solid ${C.line}`,
        borderRadius: 9,
        overflow: "hidden",
        background: "#f7f9fc",
      }}
    >
      {options.map(([val, label]) => {
        const active = val === value;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            style={{
              border: 0,
              background: active ? C.brand : "transparent",
              color: active ? "#fff" : C.muted,
              padding: "6px 11px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function cls(v: number | null | undefined): "green" | "red" {
  if (v == null) return "green";
  return v >= 0 ? "green" : "red";
}
const boxStyle = (kind: "green" | "red") =>
  kind === "green"
    ? { background: "#e7f6ee", color: "#13714c" }
    : { background: "#fdeaed", color: "#b3384a" };
const pcStyle = (kind: "green" | "red") =>
  kind === "green"
    ? { background: "#cdeede", color: "#13714c" }
    : { background: "#f7d4da", color: "#b3384a" };

function LineRow({
  label,
  note,
  value,
  box,
  total,
}: {
  label: string;
  note?: string;
  value: string;
  box?: "green" | "red";
  total?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "7px 0",
        borderBottom: `1px dashed ${C.line}`,
      }}
    >
      <div style={{ color: C.ink, fontSize: total ? 16 : 13 }}>
        {label}
        {note && (
          <small
            style={{
              display: "block",
              color: C.muted,
              fontSize: 11,
              marginTop: 1,
            }}
          >
            {note}
          </small>
        )}
      </div>
      <div style={{ fontWeight: 700, fontSize: total ? 16 : 14.5, whiteSpace: "nowrap" }}>
        {box ? (
          <span style={{ padding: "2px 9px", borderRadius: 7, ...boxStyle(box) }}>
            {value}
          </span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function RefRow({
  label,
  note,
  value,
  box,
}: {
  label: string;
  note?: string;
  value: string;
  box?: "green" | "red";
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        background: "#f8fafc",
        margin: "2px -7px",
        padding: "6px 7px",
        borderRadius: 7,
      }}
    >
      <div style={{ color: C.muted, fontSize: 12 }}>
        {label}
        {note && (
          <small
            style={{ display: "block", color: C.muted, fontSize: 11, marginTop: 1 }}
          >
            {note}
          </small>
        )}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap" }}>
        {box ? (
          <span style={{ padding: "2px 9px", borderRadius: 7, ...boxStyle(box) }}>
            {value}
          </span>
        ) : (
          <span style={{ color: "#475569" }}>{value}</span>
        )}
      </div>
    </div>
  );
}

function RetRow({
  label,
  note,
  eurValue,
  acum,
  anual,
  twrUnreliable,
}: {
  label: string;
  note?: string;
  eurValue?: number | null;
  acum: number | null;
  anual?: number | null;
  twrUnreliable?: boolean;
}) {
  const acumK = cls(acum);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "7px 0",
        borderBottom: `1px dashed ${C.line}`,
      }}
    >
      <div style={{ color: C.ink, fontSize: 13 }}>
        {label}
        {note && (
          <small
            style={{ display: "block", color: C.muted, fontSize: 11, marginTop: 1 }}
          >
            {note}
          </small>
        )}
      </div>
      <div
        style={{
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {twrUnreliable ? (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.gold }}>
            no fiable · usa MWR
          </span>
        ) : (
          <>
            {eurValue != null && (
              <span
                style={{
                  padding: "2px 9px",
                  borderRadius: 7,
                  ...boxStyle(cls(eurValue)),
                }}
              >
                {eur(eurValue)}
              </span>
            )}
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 6,
                ...pcStyle(acumK),
              }}
            >
              {spct(acum)}
            </span>
            {anual != null && (
              <span
                style={{
                  fontSize: 11.5,
                  color: C.muted,
                  fontWeight: 600,
                  marginLeft: 8,
                }}
              >
                anual {spct(anual)}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: "16px 17px",
        boxShadow: "0 1px 2px rgba(15,35,59,.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Panel({
  title,
  desc,
  controls,
  children,
}: {
  title: string;
  desc?: React.ReactNode;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 14.5, margin: "0 0 3px", color: C.brand }}>{title}</h2>
      {desc && (
        <p style={{ color: C.muted, fontSize: 12, margin: "0 0 12px" }}>{desc}</p>
      )}
      {controls && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 10,
            alignItems: "center",
          }}
        >
          {controls}
        </div>
      )}
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function CarteraV2View({
  clientName,
  accountNumber,
  positions,
  history,
  operations,
  cashBalance,
}: CarteraV2ViewProps) {
  // -------------------------------------------------------------------------
  // Selectores
  // -------------------------------------------------------------------------
  const [horizon, setHorizon] = useState<HorizonKey>("SI");
  const [retMetric, setRetMetric] = useState<RetMetric>("mwr");
  const [periodMetric, setPeriodMetric] = useState<RetMetric>("mwr");
  const [annualized, setAnnualized] = useState(false);
  const [compDim, setCompDim] = useState<CompDim>("activo");
  const [opsCatFilter, setOpsCatFilter] = useState<string>("");
  const [posSearch, setPosSearch] = useState<string>("");
  const [posPage, setPosPage] = useState<number>(1);
  const [opsPage, setOpsPage] = useState<number>(1);

  // -------------------------------------------------------------------------
  // Base: producto IIC/RV, inception, asOf, valores patrimonio
  // -------------------------------------------------------------------------
  const productTypeMap = useMemo(
    () => buildProductTypeMap(operations),
    [operations]
  );

  const t0 = useMemo(() => inceptionDate(operations), [operations]);

  const asOf = useMemo(() => {
    if (positions.length > 0 && positions[0].snapshot_date) {
      return new Date(positions[0].snapshot_date);
    }
    if (history.length > 0) return new Date(history[history.length - 1].date);
    return null;
  }, [positions, history]);

  const valorCartera = useMemo(
    () => positions.reduce((s, p) => s + (p.position_value ?? 0), 0),
    [positions]
  );
  const saldo = cashBalance;
  const patrimonioTotal = valorCartera + saldo;

  // Capital invertido = SUM(PLUS) - SUM(MINUS) sobre todas las operations.
  const capitalInvertido = useMemo(
    () => operations.reduce((s, op) => s + flowAmountEur(op), 0),
    [operations]
  );

  // Inversion en posiciones actuales (coste medio EUR, FX actual) + P&L.
  const inversionPosActuales = useMemo(
    () => positions.reduce((s, p) => s + (p.units ?? 0) * (p.avg_cost ?? 0), 0),
    [positions]
  );
  const posPnlEur = valorCartera - inversionPosActuales;
  const posPnlPct =
    inversionPosActuales > 0 ? posPnlEur / inversionPosActuales : null;

  // -------------------------------------------------------------------------
  // Flujos firmados para los modelos de rentabilidad
  // -------------------------------------------------------------------------
  const signedFlows = useMemo(
    () =>
      operations.map((op) => ({
        amount: flowAmountEur(op),
        date: op.operation_date,
      })),
    [operations]
  );

  const seriesVPos = useMemo(
    () => history.map((h) => ({ date: h.date, vPos: h.totalValue })),
    [history]
  );

  // -------------------------------------------------------------------------
  // Rentabilidades since inception (panel resumen)
  // -------------------------------------------------------------------------
  const simpleCum = useMemo(
    () => (valorCartera > 0 ? simpleReturn(valorCartera, capitalInvertido) : null),
    [valorCartera, capitalInvertido]
  );
  const simpleEur = valorCartera - capitalInvertido;
  const simpleAnn = useMemo(() => {
    if (!t0 || !asOf) return null;
    return simpleReturnAnnualized(valorCartera, capitalInvertido, t0, asOf);
  }, [valorCartera, capitalInvertido, t0, asOf]);

  const mwr = useMemo(() => {
    if (!t0 || !asOf || valorCartera <= 0) return null;
    return irrFromSignedFlows(signedFlows, valorCartera, t0, asOf);
  }, [signedFlows, valorCartera, t0, asOf]);

  const twr = useMemo(() => {
    if (!t0 || seriesVPos.length < 2) return null;
    return chainedTwr(seriesVPos, signedFlows, t0, asOf ?? undefined);
  }, [seriesVPos, signedFlows, t0, asOf]);

  const twrReliability = useMemo(
    () => assessTwrReliability(twr, mwr?.annual ?? null),
    [twr, mwr]
  );

  const twrStartLabel = twr ? fmtDateEs(twr.twrStart) : "—";

  // -------------------------------------------------------------------------
  // Series temporales: equity (NAV apilado) + rentabilidad (Grafico A)
  // -------------------------------------------------------------------------
  // Ratio cash:iic:rv del snapshot actual, aplicado a cada snapshot historico
  // (mismo criterio que combinedChartData de ClientDashboard).
  const ratios = useMemo(() => {
    let rvValue = 0;
    let iicValue = 0;
    for (const p of positions) {
      const t = resolveProductType(p.isin, p.product_name, productTypeMap);
      if (t === "rv") rvValue += p.position_value ?? 0;
      else iicValue += p.position_value ?? 0;
    }
    const total = rvValue + iicValue + saldo;
    return {
      iic: total > 0 ? iicValue / total : 0,
      rv: total > 0 ? rvValue / total : 0,
      cash: total > 0 ? saldo / total : 0,
    };
  }, [positions, productTypeMap, saldo]);

  // Capital invertido acumulado por fecha (a_neto del prototipo).
  const cumContribByDate = useMemo(() => {
    const events = signedFlows
      .filter((f) => f.date && f.amount !== 0)
      .map((f) => ({ date: String(f.date), amount: f.amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return (date: string) => {
      let sum = 0;
      for (const e of events) {
        if (e.date <= date) sum += e.amount;
        else break;
      }
      return sum;
    };
  }, [signedFlows]);

  const returnCurve = useMemo(() => {
    if (!t0 || seriesVPos.length < 2) return [];
    return returnsTimeSeries(seriesVPos, signedFlows, t0);
  }, [seriesVPos, signedFlows, t0]);

  const equityCurve = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const retByDate = new Map(returnCurve.map((r) => [r.date, r]));
    return sorted.map((s) => {
      const nav = s.totalValue;
      const r = retByDate.get(s.date);
      return {
        date: s.date,
        label: s.date.slice(0, 7),
        v_iic: nav * ratios.iic,
        v_rv: nav * ratios.rv,
        v_cash: nav * ratios.cash,
        nav,
        a_neto: cumContribByDate(s.date),
        simple: r?.simple ?? null,
        mwr: r?.mwr ?? null,
        twr: r?.twr ?? null,
      };
    });
  }, [history, ratios, cumContribByDate, returnCurve]);

  // Recorte por horizonte.
  const horizonStart = useMemo(() => {
    if (!asOf || horizon === "SI") return null;
    const a = new Date(asOf);
    if (horizon === "YTD") return new Date(a.getFullYear(), 0, 1);
    const yearsBack = { "1Y": 1, "3Y": 3, "5Y": 5 }[horizon] ?? 0;
    const d = new Date(a);
    d.setFullYear(a.getFullYear() - yearsBack);
    return d;
  }, [asOf, horizon]);

  const chartAData = useMemo(() => {
    const startIso = horizonStart ? isoDay(horizonStart) : null;
    return equityCurve
      .filter((p) => !startIso || p.date >= startIso)
      .map((p) => ({
        label: p.label,
        v_iic: p.v_iic,
        v_rv: p.v_rv,
        v_cash: p.v_cash,
        a_neto: p.a_neto,
        ret:
          p[retMetric] == null ? null : (p[retMetric] as number) * 100,
      }));
  }, [equityCurve, horizonStart, retMetric]);

  // -------------------------------------------------------------------------
  // Grafico C: rentabilidad por periodo
  // -------------------------------------------------------------------------
  const periodSeries = useMemo(() => {
    if (!t0 || seriesVPos.length < 2) return [];
    return periodReturns(seriesVPos, signedFlows, t0, asOf ?? undefined, [
      "MTD",
      "QTD",
      "YTD",
      "1A",
      "3A",
      "5A",
      "SI",
    ]);
  }, [seriesVPos, signedFlows, t0, asOf]);

  const PERIODS: Horizon[] = ["MTD", "QTD", "YTD", "1A", "3A", "5A", "SI"];
  const PERIOD_LABEL: Record<Horizon, string> = {
    MTD: "MTD",
    QTD: "GTD",
    YTD: "YTD",
    "1A": "1Y",
    "3A": "3Y",
    "5A": "5Y",
    SI: "SI",
  };

  const chartCData = useMemo(() => {
    const byPeriod = new Map(periodSeries.map((p) => [p.period, p]));
    const annOk = annualized && (periodMetric === "mwr" || periodMetric === "twr");
    return PERIODS.map((p) => {
      const o = byPeriod.get(p);
      let value: number | null = null;
      if (o) {
        const useAnn = annOk && ["3A", "5A", "SI"].includes(p);
        const key = useAnn
          ? ((periodMetric + "Ann") as "simpleAnn" | "mwrAnn" | "twrAnn")
          : periodMetric;
        const raw = (o as unknown as Record<string, number | null>)[key];
        value = raw != null ? raw * 100 : null;
      }
      return { period: PERIOD_LABEL[p], value };
    });
  }, [periodSeries, periodMetric, annualized]);

  // -------------------------------------------------------------------------
  // Grafico B: composicion actual (donut) por dimension
  // -------------------------------------------------------------------------
  const composition = useMemo(() => {
    const buildSegs = (groupKey: (p: Position) => string) => {
      const map = new Map<string, number>();
      for (const p of positions) {
        const k = groupKey(p);
        map.set(k, (map.get(k) ?? 0) + (p.position_value ?? 0));
      }
      // Cash EUR siempre incluido
      if (saldo > 0) map.set("Cash EUR", (map.get("Cash EUR") ?? 0) + saldo);
      const all = Array.from(map.entries())
        .map(([label, value_eur]) => ({ label, value_eur }))
        .sort((a, b) => b.value_eur - a.value_eur);
      if (all.length <= 11) return all;
      const top = all.slice(0, 10);
      const rest = all.slice(10).reduce((s, x) => s + x.value_eur, 0);
      return [...top, { label: "Otros", value_eur: rest }];
    };

    return {
      activo: buildSegs((p) => p.product_name ?? p.isin ?? "—"),
      tipo: buildSegs((p) =>
        resolveProductType(p.isin, p.product_name, productTypeMap) === "rv"
          ? "Renta variable"
          : "Fondos (IIC)"
      ),
      gestora: buildSegs((p) => p.manager || "Otros"),
      divisa: buildSegs((p) => p.currency || "EUR"),
    } as Record<CompDim, { label: string; value_eur: number }[]>;
  }, [positions, saldo, productTypeMap]);

  const donutData = composition[compDim];
  const donutTotal = donutData.reduce((s, x) => s + x.value_eur, 0);

  // -------------------------------------------------------------------------
  // Grafico D: contribuidores / detractores al P&L (SI)
  // -------------------------------------------------------------------------
  const pnlByPosition = useMemo(() => {
    return positions
      .map((p) => {
        const cost = (p.units ?? 0) * (p.avg_cost ?? 0);
        const value = p.position_value ?? 0;
        return {
          nombre: p.product_name ?? p.isin ?? "—",
          isin: p.isin ?? "",
          pnl_eur: value - cost,
        };
      })
      .filter((x) => Math.abs(x.pnl_eur) > 0);
  }, [positions]);

  const contribDetract = useMemo(() => {
    const sorted = [...pnlByPosition].sort((a, b) => b.pnl_eur - a.pnl_eur);
    const contributors = sorted.filter((x) => x.pnl_eur > 0).slice(0, 5);
    const detractors = sorted
      .filter((x) => x.pnl_eur < 0)
      .slice(-5);
    // Orden visual: detractores (mas negativo arriba) + contribuidores (mas
    // positivo abajo) — replica items=[...d, ...c.reverse()] del prototipo,
    // que en layout horizontal de Recharts se pinta de abajo->arriba.
    const items = [...contributors.slice().reverse(), ...detractors];
    return items.map((x) => ({
      nombre:
        x.nombre.length > 28 ? x.nombre.slice(0, 27) + "…" : x.nombre,
      pnl_eur: x.pnl_eur,
    }));
  }, [pnlByPosition]);

  // -------------------------------------------------------------------------
  // Tabla posiciones
  // -------------------------------------------------------------------------
  const posRows = useMemo(() => {
    return positions
      .map((p) => {
        const cost = (p.units ?? 0) * (p.avg_cost ?? 0);
        const value = p.position_value ?? 0;
        const pnl = value - cost;
        return {
          isin: p.isin ?? "—",
          nombre: p.product_name ?? "—",
          tipo:
            resolveProductType(p.isin, p.product_name, productTypeMap) === "rv"
              ? "RV"
              : "IIC",
          divisa: p.currency || "EUR",
          titulos: p.units ?? 0,
          coste_medio_eur: p.avg_cost ?? 0,
          precio_mercado_eur: p.market_price ?? 0,
          valor_eur: value,
          weight: valorCartera > 0 ? value / valorCartera : 0,
          pnl_eur: pnl,
          pnl_pct: cost > 0 ? pnl / cost : null,
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [positions, productTypeMap, valorCartera]);

  // -------------------------------------------------------------------------
  // Tabla operaciones
  // -------------------------------------------------------------------------
  const opRows = useMemo(() => {
    return [...operations]
      .sort((a, b) =>
        (b.operation_date ?? "").localeCompare(a.operation_date ?? "")
      )
      .map((op) => {
        const cat = classifyFlow(op.operation_type ?? "");
        return {
          fecha: op.operation_date ?? "—",
          tipo: op.operation_type ?? "—",
          categoria:
            cat === "plus" ? "PLUS" : cat === "minus" ? "MINUS" : "NEUTRO",
          producto: op.product_name ?? "—",
          isin: op.isin ?? "—",
          titulos: op.units ?? 0,
          divisa: op.currency || "EUR",
          efectivo_neto: op.net_amount ?? op.eur_amount ?? 0,
          tipo_cambio: op.fx_rate ?? 1,
          cf_ext_eur: flowAmountEur(op),
        };
      });
  }, [operations]);

  const opRowsFiltered = useMemo(
    () =>
      opsCatFilter
        ? opRows.filter((o) => o.categoria === opsCatFilter)
        : opRows,
    [opRows, opsCatFilter]
  );

  // -------------------------------------------------------------------------
  // Tabla posiciones: busqueda + paginacion (20/pag)
  // -------------------------------------------------------------------------
  const POS_PAGE_SIZE = 20;
  const posRowsFiltered = useMemo(() => {
    const q = posSearch.trim().toLowerCase();
    if (!q) return posRows;
    return posRows.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) || r.isin.toLowerCase().includes(q)
    );
  }, [posRows, posSearch]);

  const posTotalPages = Math.max(
    1,
    Math.ceil(posRowsFiltered.length / POS_PAGE_SIZE)
  );
  const posPageSafe = Math.min(posPage, posTotalPages);
  const posRowsPage = useMemo(
    () =>
      posRowsFiltered.slice(
        (posPageSafe - 1) * POS_PAGE_SIZE,
        posPageSafe * POS_PAGE_SIZE
      ),
    [posRowsFiltered, posPageSafe]
  );

  // -------------------------------------------------------------------------
  // Tabla operaciones: paginacion (15/pag)
  // -------------------------------------------------------------------------
  const OPS_PAGE_SIZE = 15;
  const opsTotalPages = Math.max(
    1,
    Math.ceil(opRowsFiltered.length / OPS_PAGE_SIZE)
  );
  const opsPageSafe = Math.min(opsPage, opsTotalPages);
  const opRowsPage = useMemo(
    () =>
      opRowsFiltered.slice(
        (opsPageSafe - 1) * OPS_PAGE_SIZE,
        opsPageSafe * OPS_PAGE_SIZE
      ),
    [opRowsFiltered, opsPageSafe]
  );

  // -------------------------------------------------------------------------
  // Avisos (no bloqueantes)
  // -------------------------------------------------------------------------
  const warnings: string[] = useMemo(() => {
    const w: string[] = [];
    if (!twrReliability.reliable) {
      w.push(
        "TWR≈ marcado como no fiable (snapshots semanales + liquidacion diferida). Usa MWR como referencia."
      );
    }
    if (t0 && t0.getFullYear() <= 2021) {
      w.push(
        "El registro de operaciones de Mapfre cubre desde 2021-01-01; compras anteriores pueden no tener coste reconstruido (FIFO incompleto)."
      );
    }
    if (history.length < 2) {
      w.push("Pocos snapshots disponibles: las series temporales pueden ser limitadas.");
    }
    return w;
  }, [twrReliability, t0, history]);

  // -------------------------------------------------------------------------
  // Tooltips Recharts
  // -------------------------------------------------------------------------
  const eurTooltip = (value: number) => eur0(value);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink }}>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "20px 18px 60px",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
          fontSize: 14,
          lineHeight: 1.45,
        }}
      >
        {/* ---------------- Header ---------------- */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 18,
                margin: "0 0 2px",
                letterSpacing: ".2px",
                color: C.brand,
              }}
            >
              Evolución de la cartera
            </h1>
            <div style={{ color: C.muted, fontSize: 12.5 }}>
              Cliente <b>{clientName}</b> · Cuenta de Valores (CV) {accountNumber}
            </div>
          </div>
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
          >
            <Badge>Datos a fecha {asOf ? fmtDateEs(asOf) : "—"}</Badge>
            <Badge>Inception {t0 ? fmtDateEs(t0) : "—"}</Badge>
            <Badge>
              {history.length} snapshots · {operations.length} ops
            </Badge>
            <Badge warn>Neto de comisiones · EUR</Badge>
          </div>
        </header>

        {/* ---------------- Resumen ---------------- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <Card>
            <SumTitle>Patrimonio</SumTitle>
            <LineRow label="Saldo (efectivo)" value={eur(saldo)} />
            <LineRow label="Valor actual de la cartera" value={eur(valorCartera)} />
            <LineRow
              label="Patrimonio total"
              value={eur(patrimonioTotal)}
              box="green"
              total
            />
            <LineRow
              label="Capital invertido"
              note="Inversiones menos reembolsos"
              value={eur(capitalInvertido)}
            />
          </Card>

          <Card>
            <SumTitle>Rentabilidades · since inception</SumTitle>
            <RefRow
              label="Capital invertido"
              note="Base de cálculo · inversiones menos reembolsos"
              value={eur(capitalInvertido)}
            />
            <RetRow
              label="Rentabilidad simple"
              note="Valor de cartera vs. capital invertido"
              eurValue={simpleEur}
              acum={simpleCum}
              anual={simpleAnn}
            />
            <RetRow
              label="Rentabilidad MWR"
              note="Money-weighted (TIR de flujos)"
              acum={mwr?.cumulative ?? null}
              anual={mwr?.annual ?? null}
            />
            <RetRow
              label={"Rentabilidad TWR≈"}
              note={`Time-weighted · desde ${twrStartLabel} (no since-inception, D9)`}
              acum={twr?.cumulative ?? null}
              anual={twr?.annual ?? null}
              twrUnreliable={!twrReliability.reliable}
            />
            <RefRow
              label="Inversión en posiciones actuales"
              note="Base de cálculo · usa el tipo de cambio actual, no el de compra"
              value={eur(inversionPosActuales)}
              box="red"
            />
            <RetRow
              label="Rentab. posiciones actuales"
              note="Valor vs. coste (FX actual)"
              eurValue={posPnlEur}
              acum={posPnlPct}
            />
          </Card>
        </div>

        {/* ---------------- Grafico A ---------------- */}
        <Panel
          title="Patrimonio vs. capital invertido acumulado"
          desc={
            <>
              Barras apiladas = valor de cartera (Fondos IIC · Renta variable ·
              Efectivo). Línea = capital invertido acumulado. La diferencia es el
              P&amp;L.
            </>
          }
          controls={
            <>
              <Seg<HorizonKey>
                options={[
                  ["SI", "Desde inicio"],
                  ["5Y", "5A"],
                  ["3Y", "3A"],
                  ["1Y", "1A"],
                  ["YTD", "YTD"],
                ]}
                value={horizon}
                onChange={setHorizon}
              />
              <span style={{ alignSelf: "center", marginLeft: 8, fontSize: 11, color: C.muted }}>
                Rentab.:
              </span>
              <Seg<RetMetric>
                options={[
                  ["mwr", "MWR"],
                  ["simple", "Simple"],
                  ["twr", "TWR≈"],
                ]}
                value={retMetric}
                onChange={setRetMetric}
              />
            </>
          }
        >
          <div style={{ height: 330 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartAData}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid stroke="#eef1f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: C.muted }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 10, fill: "#9aa6b8" }}
                  width={44}
                  label={{
                    value: "EUR",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: C.muted },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: "#9aa6b8" }}
                  width={44}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const retName = `Rentab. ${RET_LABEL[retMetric]}`;
                    let navTotal = 0;
                    for (const p of payload) {
                      if (
                        p.dataKey === "v_iic" ||
                        p.dataKey === "v_rv" ||
                        p.dataKey === "v_cash"
                      ) {
                        navTotal += (p.value as number) ?? 0;
                      }
                    }
                    return (
                      <div
                        style={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: `1px solid ${C.line}`,
                          background: "#fff",
                          padding: "8px 10px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4, color: C.ink }}>
                          {label}
                        </div>
                        {payload.map((p, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              color: (p.color as string) ?? C.ink,
                            }}
                          >
                            <span>{p.name}</span>
                            <span style={{ fontWeight: 600 }}>
                              {p.name === retName
                                ? spct((p.value as number) / 100)
                                : eur0(p.value as number)}
                            </span>
                          </div>
                        ))}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            marginTop: 4,
                            paddingTop: 4,
                            borderTop: `1px solid ${C.line}`,
                            fontWeight: 700,
                            color: C.ink,
                          }}
                        >
                          <span>NAV total</span>
                          <span>{eur0(navTotal)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="v_iic"
                  stackId="v"
                  name="Fondos (IIC)"
                  fill={C.iic}
                />
                <Bar
                  yAxisId="left"
                  dataKey="v_rv"
                  stackId="v"
                  name="Renta variable"
                  fill={C.rv}
                />
                <Bar
                  yAxisId="left"
                  dataKey="v_cash"
                  stackId="v"
                  name="Efectivo"
                  fill={C.cash}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="a_neto"
                  name="Capital invertido"
                  stroke={C.capital}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="ret"
                  name={`Rentab. ${RET_LABEL[retMetric]}`}
                  stroke={C.ret}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            items={[
              { color: C.iic, label: "Fondos (IIC)" },
              { color: C.rv, label: "Renta variable (RV)" },
              { color: C.cash, label: "Efectivo (Cash EUR)" },
              { color: C.capital, label: "Capital invertido acumulado" },
              {
                color: C.ret,
                label: `Rentab. ${RET_LABEL[retMetric]} (eje dcho.)`,
              },
            ]}
          />
        </Panel>

        {/* ---------------- Fila: Grafico C + Grafico B ---------------- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr",
            gap: 16,
          }}
        >
          <Panel
            title="Rentabilidad por periodo"
            desc="Selecciona métrica. Anualizable en 3Y/5Y/SI (MWR y TWR)."
            controls={
              <>
                <Seg<RetMetric>
                  options={[
                    ["mwr", "MWR"],
                    ["simple", "Simple"],
                    ["twr", "TWR≈"],
                  ]}
                  value={periodMetric}
                  onChange={setPeriodMetric}
                />
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: C.muted,
                    cursor: "pointer",
                    marginLeft: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={annualized}
                    onChange={(e) => setAnnualized(e.target.checked)}
                  />
                  Anualizada
                </label>
              </>
            }
          >
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartCData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="#eef1f6" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    tick={{ fontSize: 10, fill: "#9aa6b8" }}
                    width={44}
                  />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <Tooltip
                    formatter={(v: number) => [
                      spct(v / 100),
                      RET_LABEL[periodMetric] +
                        (periodMetric === "twr" ? " (aprox.)" : ""),
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }}
                  />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                    {chartCData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.value == null
                            ? "#e4e9f0"
                            : d.value >= 0
                              ? C.pos
                              : C.neg
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel
            title="Composición actual"
            desc="Top 10 + “Otros”. Incluye efectivo."
            controls={
              <Seg<CompDim>
                options={[
                  ["activo", "Activo"],
                  ["tipo", "Tipo"],
                  ["gestora", "Gestora"],
                  ["divisa", "Divisa"],
                ]}
                value={compDim}
                onChange={setCompDim}
              />
            }
          >
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value_eur"
                    nameKey="label"
                    cx="42%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={95}
                    paddingAngle={1}
                    stroke="#fff"
                  >
                    {donutData.map((s, i) => (
                      <Cell
                        key={i}
                        fill={
                          s.label === "Cash EUR"
                            ? C.cash
                            : s.label === "Otros"
                              ? C.otros
                              : PAL[i % PAL.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, n: string) => [
                      `${eur0(v)} (${donutTotal > 0 ? ((v / donutTotal) * 100).toFixed(1) : "0.0"}%)`,
                      n,
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "4px 12px",
                fontSize: 11,
                color: C.muted,
                marginTop: 6,
              }}
            >
              {donutData.map((s, i) => (
                <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <i
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background:
                        s.label === "Cash EUR"
                          ? C.cash
                          : s.label === "Otros"
                            ? C.otros
                            : PAL[i % PAL.length],
                    }}
                  />
                  {s.label.length > 22 ? s.label.slice(0, 21) + "…" : s.label}
                </span>
              ))}
            </div>
          </Panel>
        </div>

        {/* ---------------- Grafico D ---------------- */}
        <Panel
          title="Top contribuidores / detractores al P&L"
          desc="P&L absoluto en EUR por activo (valor de mercado vs. coste medio), Since Inception."
        >
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={contribDetract}
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="#eef1f6" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 10, fill: "#9aa6b8" }}
                />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  tick={{ fontSize: 11, fill: C.muted }}
                  width={180}
                />
                <ReferenceLine x={0} stroke="#cbd5e1" />
                <Tooltip
                  formatter={(v: number) => [
                    `${v >= 0 ? "+" : ""}${eur0(v)}`,
                    "P&L",
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }}
                />
                <Bar dataKey="pnl_eur" radius={[0, 4, 4, 0]}>
                  {contribDetract.map((d, i) => (
                    <Cell key={i} fill={d.pnl_eur >= 0 ? C.pos : C.neg} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* ---------------- Tabla posiciones ---------------- */}
        <Panel
          title={`Detalle de posiciones`}
          desc="Ordenadas por peso en cartera."
        >
          <div style={{ marginTop: -6, marginBottom: 8, fontSize: 11, color: C.muted }}>
            ({posRowsFiltered.length} activos)
          </div>
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              value={posSearch}
              onChange={(e) => {
                setPosSearch(e.target.value);
                setPosPage(1);
              }}
              placeholder="Type a keyword…"
              style={{
                padding: "5px 8px",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                fontSize: 12,
                background: "#f7f9fc",
                color: C.ink,
                width: 240,
                maxWidth: "100%",
              }}
            />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {[
                    "ISIN",
                    "Nombre",
                    "Tipo",
                    "Divisa",
                    "Títulos",
                    "Coste medio €",
                    "Precio merc. €",
                    "Valor €",
                    "% cart.",
                    "P&L €",
                    "P&L %",
                  ].map((h, i) => (
                    <Th key={h} left={i < 4}>
                      {h}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posRowsPage.map((r) => (
                  <tr key={r.isin + r.nombre}>
                    <Td left>{r.isin}</Td>
                    <Td left>{r.nombre}</Td>
                    <Td left>{r.tipo}</Td>
                    <Td left>{r.divisa}</Td>
                    <Td>{num(r.titulos, 2)}</Td>
                    <Td>{eur(r.coste_medio_eur)}</Td>
                    <Td>{eur(r.precio_mercado_eur)}</Td>
                    <Td bold>{eur(r.valor_eur)}</Td>
                    <Td>{pct(r.weight)}</Td>
                    <Td color={r.pnl_eur >= 0 ? C.pos : C.neg}>
                      {(r.pnl_eur >= 0 ? "+" : "") + eur(r.pnl_eur)}
                    </Td>
                    <Td color={(r.pnl_pct ?? 0) >= 0 ? C.pos : C.neg}>
                      {spct(r.pnl_pct)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={posPageSafe}
            totalPages={posTotalPages}
            totalItems={posRowsFiltered.length}
            pageSize={POS_PAGE_SIZE}
            onPage={setPosPage}
          />
        </Panel>

        {/* ---------------- Tabla operaciones ---------------- */}
        <Panel title="Histórico de operaciones">
          <div style={{ marginTop: -6, marginBottom: 8, fontSize: 11, color: C.muted }}>
            ({opRowsFiltered.length} operaciones)
          </div>
          <div style={{ marginBottom: 10 }}>
            <select
              value={opsCatFilter}
              onChange={(e) => {
                setOpsCatFilter(e.target.value);
                setOpsPage(1);
              }}
              style={{
                padding: "5px 8px",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                fontSize: 12,
                background: "#f7f9fc",
                color: C.ink,
              }}
            >
              <option value="">Todas las categorías</option>
              <option value="PLUS">PLUS</option>
              <option value="MINUS">MINUS</option>
              <option value="NEUTRO">NEUTRO</option>
            </select>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {[
                    "Fecha",
                    "Tipo",
                    "Cat.",
                    "Producto",
                    "ISIN",
                    "Títulos",
                    "Divisa",
                    "Efectivo neto",
                    "T.Cambio",
                    "CF ext. €",
                  ].map((h, i) => (
                    <Th key={h} left={i < 5 || i === 6}>
                      {h}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {opRowsPage.map((o, idx) => {
                  const catColor =
                    o.categoria === "PLUS"
                      ? C.pos
                      : o.categoria === "MINUS"
                        ? C.neg
                        : C.muted;
                  const cfNeutral = Math.abs(o.cf_ext_eur) < 0.005;
                  return (
                    <tr key={idx}>
                      <Td left>{o.fecha}</Td>
                      <Td left>{o.tipo}</Td>
                      <Td left>
                        <span style={{ color: catColor, fontWeight: 600 }}>
                          {o.categoria}
                        </span>
                      </Td>
                      <Td left>{o.producto}</Td>
                      <Td left>{o.isin}</Td>
                      <Td>{num(o.titulos, 2)}</Td>
                      <Td left>{o.divisa}</Td>
                      <Td>{num(o.efectivo_neto, 2)}</Td>
                      <Td>{num(o.tipo_cambio, 4)}</Td>
                      <Td
                        color={
                          cfNeutral
                            ? C.muted
                            : o.cf_ext_eur >= 0
                              ? C.pos
                              : C.neg
                        }
                      >
                        {cfNeutral
                          ? "0,00 €"
                          : (o.cf_ext_eur >= 0 ? "+" : "") + eur(o.cf_ext_eur)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={opsPageSafe}
            totalPages={opsTotalPages}
            totalItems={opRowsFiltered.length}
            pageSize={OPS_PAGE_SIZE}
            onPage={setOpsPage}
          />
        </Panel>

        {/* ---------------- Avisos ---------------- */}
        <div
          style={{
            background: "#fff7ec",
            border: "1px solid #f0d9b5",
            borderRadius: 12,
            padding: "12px 15px",
            fontSize: 12,
            color: "#7a5b1e",
            marginTop: 6,
          }}
        >
          <b style={{ color: C.gold }}>Avisos (no bloqueantes):</b>{" "}
          {warnings.length > 0 ? warnings.join(" · ") : "Ninguno."}
        </div>

        <p
          style={{
            textAlign: "center",
            color: C.muted,
            fontSize: 11,
            marginTop: 14,
          }}
        >
          WM Platform · vista de cartera (v2) · cálculos deterministas reutilizando
          el modelo de rentabilidades del dashboard.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational atoms
// ---------------------------------------------------------------------------
function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const btn = (disabled: boolean): React.CSSProperties => ({
    padding: "4px 10px",
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    fontSize: 12,
    background: disabled ? "#f1f4f8" : "#fff",
    color: disabled ? C.muted : C.ink,
    cursor: disabled ? "default" : "pointer",
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 10,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 11, color: C.muted }}>
        Showing {from} to {to} of {totalItems}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          style={btn(page <= 1)}
        >
          Previous
        </button>
        <span style={{ fontSize: 12, color: C.ink }}>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          style={btn(page >= totalPages)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Badge({
  children,
  warn,
}: {
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <span
      style={{
        background: warn ? "#fff7ec" : "#eef3f9",
        color: warn ? C.gold : C.brand,
        border: `1px solid ${warn ? "#f0d9b5" : C.line}`,
        borderRadius: 999,
        padding: "4px 11px",
        fontSize: 11.5,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function SumTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 12,
        margin: "0 0 11px",
        color: C.muted,
        textTransform: "uppercase",
        letterSpacing: ".5px",
        fontWeight: 700,
      }}
    >
      {children}
    </h3>
  );
}

function ChartLegend({
  items,
}: {
  items: { color: string; label: string }[];
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        fontSize: 12,
        color: C.muted,
        marginTop: 8,
      }}
    >
      {items.map((it) => (
        <span key={it.label}>
          <i
            style={{
              display: "inline-block",
              width: 11,
              height: 11,
              borderRadius: 3,
              marginRight: 5,
              verticalAlign: -1,
              background: it.color,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Th({
  children,
  left,
}: {
  children: React.ReactNode;
  left?: boolean;
}) {
  return (
    <th
      style={{
        padding: "6px 8px",
        borderBottom: `1px solid ${C.line}`,
        textAlign: left ? "left" : "right",
        color: C.muted,
        fontWeight: 600,
        fontSize: 11,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  left,
  bold,
  color,
}: {
  children: React.ReactNode;
  left?: boolean;
  bold?: boolean;
  color?: string;
}) {
  return (
    <td
      style={{
        padding: "6px 8px",
        borderBottom: `1px solid ${C.line}`,
        textAlign: left ? "left" : "right",
        fontWeight: bold ? 700 : 400,
        color: color ?? C.ink,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
