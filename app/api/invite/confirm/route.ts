import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/error";

/**
 * POST /api/invite/confirm
 * Links an auth user to their client record after password creation.
 * Called from the invite confirmation page.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, userId } = body;

    if (!email || !userId) {
      return NextResponse.json({ error: "email y userId requeridos" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Find the pending invitation for this email
    const { data: invitation } = await admin
      .from("invitations")
      .select("id, client_id")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .order("invited_at", { ascending: false })
      .limit(1)
      .single();

    if (!invitation) {
      // No invitation found — might be a direct signup, skip linking
      return NextResponse.json({ ok: true, linked: false });
    }

    // Link auth user to client
    await admin
      .from("clients")
      .update({ auth_user_id: userId, email: email.toLowerCase() })
      .eq("id", invitation.client_id);

    // Mark invitation as confirmed
    await admin
      .from("invitations")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return NextResponse.json({ ok: true, linked: true, clientId: invitation.client_id });
  } catch (err) {
    captureError(err, "Invite confirm");
    return NextResponse.json({ error: "Error confirmando invitacion" }, { status: 500 });
  }
}
