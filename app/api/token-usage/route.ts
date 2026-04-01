import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/security";
import { getTokenUsageSummary } from "@/lib/tokens";

/**
 * GET /api/token-usage?year=2026&month=4
 * Returns token usage summary. Owner only.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireOwner();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const now = new Date();
  const year = parseInt(params.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(params.get("month") ?? String(now.getMonth() + 1), 10);

  try {
    const summary = await getTokenUsageSummary(year, month);
    return NextResponse.json(summary);
  } catch (err) {
    const { captureError } = await import("@/lib/error");
    captureError(err, "Token Usage API");
    return NextResponse.json({ error: "Error obteniendo datos" }, { status: 500 });
  }
}
