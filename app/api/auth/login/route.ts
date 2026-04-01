import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
  logSecurityEvent,
  sanitizeInput,
} from "@/lib/security";

/**
 * POST /api/auth/login
 * Server-side login with rate limiting and security logging.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Rate limit check
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    await logSecurityEvent(ip, null, "login_blocked_rate_limit", false);
    return NextResponse.json(
      { error: "Demasiados intentos. Espera 15 minutos." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter ?? 900) },
      }
    );
  }

  const body = await req.json();
  const email = sanitizeInput(body.email ?? "", 200);
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y contraseña requeridos" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    await logSecurityEvent(ip, email, "login_failed", false);
    return NextResponse.json(
      {
        error:
          authError.message === "Invalid login credentials"
            ? "Email o contraseña incorrectos"
            : authError.message,
      },
      { status: 401 }
    );
  }

  // Success — reset rate limit and log
  resetRateLimit(ip);
  await logSecurityEvent(ip, email, "login_success", true);

  // Get role for redirect
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.app_metadata?.role;
  const redirect = role === "admin" || role === "owner" ? "/admin" : "/dashboard";

  return NextResponse.json({ redirect });
}
