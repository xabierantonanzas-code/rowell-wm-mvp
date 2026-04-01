import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
  logSecurityEvent,
  sanitizeInput,
} from "@/lib/security";

/**
 * POST /api/auth/login
 * Rate limit check + security logging.
 * Actual auth happens client-side (Supabase needs to set cookies on the browser).
 *
 * Flow:
 *   1. Client calls this endpoint to check rate limit
 *   2. If allowed, client performs signInWithPassword client-side
 *   3. Client calls POST /api/auth/login/result to log success/failure
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const body = await req.json();
  const email = sanitizeInput(body.email ?? "", 200);
  const action = body.action ?? "check"; // "check" | "success" | "failure"

  if (action === "check") {
    // Rate limit check before login attempt
    const { allowed, retryAfter } = checkRateLimit(ip);
    if (!allowed) {
      await logSecurityEvent(ip, email, "login_blocked_rate_limit", false);
      return NextResponse.json(
        { error: "Demasiados intentos. Espera 15 minutos." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter ?? 900) },
        }
      );
    }
    return NextResponse.json({ allowed: true });
  }

  if (action === "success") {
    resetRateLimit(ip);
    await logSecurityEvent(ip, email, "login_success", true);
    return NextResponse.json({ ok: true });
  }

  if (action === "failure") {
    await logSecurityEvent(ip, email, "login_failed", false);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
}
