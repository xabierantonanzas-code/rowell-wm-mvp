import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health
 * Health check endpoint — verifies Supabase connection and basic app state.
 * Public (no auth required).
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};

  // Check Supabase connection
  try {
    const dbStart = Date.now();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("positions")
      .select("id")
      .limit(1);

    checks.database = {
      ok: !error,
      ms: Date.now() - dbStart,
      error: error?.message,
    };
  } catch (err) {
    checks.database = {
      ok: false,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // Check Supabase Auth
  try {
    const authStart = Date.now();
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();
    checks.auth = {
      ok: !error,
      ms: Date.now() - authStart,
      error: error?.message,
    };
  } catch (err) {
    checks.auth = {
      ok: false,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // Environment variables
  checks.env = {
    ok: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
    ms: 0,
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  const totalMs = Date.now() - start;

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      totalMs,
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
