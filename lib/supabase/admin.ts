import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con service_role key.
 * SOLO usar en server-side (API routes, server actions).
 * Bypassa RLS — usar con cuidado.
 */
export function createAdminClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
