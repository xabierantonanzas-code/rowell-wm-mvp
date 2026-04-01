import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ===========================================================================
// Roles
// ===========================================================================

export type AppRole = "owner" | "admin" | "client";

export function getUserRole(user: { app_metadata?: Record<string, any> }): AppRole {
  const role = user.app_metadata?.role;
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  return "client";
}

export function isOwner(user: { app_metadata?: Record<string, any> }): boolean {
  return getUserRole(user) === "owner";
}

export function isAdminOrOwner(user: { app_metadata?: Record<string, any> }): boolean {
  const role = getUserRole(user);
  return role === "admin" || role === "owner";
}

// ===========================================================================
// Auth check for API routes
// ===========================================================================

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  return { user, error: null };
}

export async function requireAdmin() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  if (!isAdminOrOwner(user!)) {
    return { user: null, error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { user: user!, error: null };
}

export async function requireOwner() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  if (!isOwner(user!)) {
    return { user: null, error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { user: user!, error: null };
}

// ===========================================================================
// Input Sanitization
// ===========================================================================

/**
 * Sanitize input string: trim, remove control chars, limit length.
 * Does NOT strip HTML — Supabase parameterized queries prevent SQL injection,
 * and React escapes output by default (XSS safe).
 */
export function sanitizeInput(input: string, maxLength = 1000): string {
  // eslint-disable-next-line no-control-regex
  return input.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").slice(0, maxLength);
}

// ===========================================================================
// Rate Limiting (in-memory, per-process)
// ===========================================================================

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  // Cleanup old entries periodically
  if (rateLimitStore.size > 10000) {
    rateLimitStore.forEach((val, key) => {
      if (now - val.firstAttempt > RATE_LIMIT_WINDOW * 2) {
        rateLimitStore.delete(key);
      }
    });
  }

  if (!entry) {
    rateLimitStore.set(ip, { attempts: 1, firstAttempt: now, blockedUntil: 0 });
    return { allowed: true };
  }

  // Currently blocked?
  if (entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Window expired? Reset
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { attempts: 1, firstAttempt: now, blockedUntil: 0 });
    return { allowed: true };
  }

  entry.attempts++;

  if (entry.attempts > MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_DURATION;
    return { allowed: false, retryAfter: Math.ceil(BLOCK_DURATION / 1000) };
  }

  return { allowed: true };
}

export function resetRateLimit(ip: string) {
  rateLimitStore.delete(ip);
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ===========================================================================
// Security Logs
// ===========================================================================

export async function logSecurityEvent(
  ip: string,
  email: string | null,
  action: string,
  success: boolean
) {
  try {
    const admin = createAdminClient();
    await admin.from("security_logs").insert({
      ip,
      email,
      action,
      success,
    });
  } catch (e) {
    // Don't let logging failures break the app
    console.error("Failed to log security event:", e);
  }
}

// ===========================================================================
// Environment Variable Validation
// ===========================================================================

export function validateEnvVars() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  // Audit: ensure secrets are not exposed via NEXT_PUBLIC_
  const publicVars = Object.keys(process.env).filter((k) =>
    k.startsWith("NEXT_PUBLIC_")
  );
  for (const key of publicVars) {
    if (key.includes("SECRET") || key.includes("SERVICE_ROLE")) {
      throw new Error(
        `SECURITY: ${key} contains a secret but starts with NEXT_PUBLIC_. This exposes it to the client.`
      );
    }
  }
}
