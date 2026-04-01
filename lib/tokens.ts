import { createAdminClient } from "@/lib/supabase/admin";

// Pricing: Claude Opus input $3/MTok, output $15/MTok
const PRICE_INPUT_PER_TOKEN = 3 / 1_000_000;
const PRICE_OUTPUT_PER_TOKEN = 15 / 1_000_000;

/**
 * Log token usage from a Claude API call.
 */
export async function logTokenUsage(
  endpoint: string,
  tokensInput: number,
  tokensOutput: number
) {
  const costeUsd =
    tokensInput * PRICE_INPUT_PER_TOKEN +
    tokensOutput * PRICE_OUTPUT_PER_TOKEN;

  try {
    const admin = createAdminClient();
    await admin.from("token_usage").insert({
      endpoint,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      coste_usd: costeUsd,
    });
  } catch (e) {
    console.error("Failed to log token usage:", e);
  }
}

/**
 * Get token usage summary for a given month.
 */
export async function getTokenUsageSummary(year: number, month: number) {
  const admin = createAdminClient();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const { data, error } = await admin
    .from("token_usage")
    .select("endpoint, tokens_input, tokens_output, coste_usd, fecha")
    .gte("fecha", startDate)
    .lt("fecha", endDate)
    .order("fecha", { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const totalInput = rows.reduce((s, r) => s + (r.tokens_input ?? 0), 0);
  const totalOutput = rows.reduce((s, r) => s + (r.tokens_output ?? 0), 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.coste_usd ?? 0), 0);

  // Group by day
  const byDay = new Map<string, { input: number; output: number; cost: number }>();
  for (const r of rows) {
    const day = r.fecha;
    const existing = byDay.get(day) ?? { input: 0, output: 0, cost: 0 };
    existing.input += r.tokens_input ?? 0;
    existing.output += r.tokens_output ?? 0;
    existing.cost += Number(r.coste_usd ?? 0);
    byDay.set(day, existing);
  }

  // Group by endpoint
  const byEndpoint = new Map<string, { input: number; output: number; cost: number; calls: number }>();
  for (const r of rows) {
    const ep = r.endpoint;
    const existing = byEndpoint.get(ep) ?? { input: 0, output: 0, cost: 0, calls: 0 };
    existing.input += r.tokens_input ?? 0;
    existing.output += r.tokens_output ?? 0;
    existing.cost += Number(r.coste_usd ?? 0);
    existing.calls++;
    byEndpoint.set(ep, existing);
  }

  return {
    totalInput,
    totalOutput,
    totalCost,
    totalCalls: rows.length,
    byDay: Array.from(byDay.entries()).map(([date, d]) => ({ date, ...d })),
    byEndpoint: Array.from(byEndpoint.entries()).map(([endpoint, d]) => ({ endpoint, ...d })),
  };
}
