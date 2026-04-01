import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/security-logs
 * Returns recent security events. Owner only.
 */
export async function GET() {
  const { error } = await requireOwner();
  if (error) return error;

  const admin = createAdminClient();

  const { data, error: dbError } = await admin
    .from("security_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
