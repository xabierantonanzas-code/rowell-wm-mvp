import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, sanitizeInput } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/error";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/invite
 * Invita a un cliente por email. Solo admin/owner.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const email = sanitizeInput(body.email ?? "", 200).toLowerCase();
    const clientId = body.client_id;

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Email invalido" }, { status: 400 });
    }
    if (!clientId || !UUID_REGEX.test(clientId)) {
      return NextResponse.json({ error: "client_id invalido" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check if client exists
    const { data: client } = await admin
      .from("clients")
      .select("id, full_name, auth_user_id")
      .eq("id", clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // Check if client already has auth user
    if (client.auth_user_id) {
      return NextResponse.json({ error: "Este cliente ya tiene acceso activo" }, { status: 409 });
    }

    // Check if there's already a pending invitation
    const { data: existingInvite } = await admin
      .from("invitations")
      .select("id, status")
      .eq("client_id", clientId)
      .eq("status", "pending")
      .limit(1);

    if (existingInvite && existingInvite.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una invitacion pendiente para este cliente" },
        { status: 409 }
      );
    }

    // Check if email already has an auth user
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email
    );
    if (emailExists) {
      return NextResponse.json(
        { error: "Este email ya tiene una cuenta en el sistema" },
        { status: 409 }
      );
    }

    // Send invitation via Supabase
    const redirectTo = `${req.nextUrl.origin}/invite/confirm`;

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo }
    );

    if (inviteError) {
      captureError(inviteError, "Invite user");
      return NextResponse.json(
        { error: "Error enviando invitacion: " + inviteError.message },
        { status: 500 }
      );
    }

    // Save invitation record
    await admin.from("invitations").insert({
      client_id: clientId,
      email,
      invited_by: user!.id,
      status: "pending",
    });

    // Update client email if not set
    const { data: clientData } = await admin
      .from("clients")
      .select("email")
      .eq("id", clientId)
      .single();

    if (!clientData?.email) {
      await admin
        .from("clients")
        .update({ email })
        .eq("id", clientId);
    }

    return NextResponse.json({
      success: true,
      message: `Invitacion enviada a ${email}`,
    });
  } catch (err) {
    captureError(err, "Invite API");
    return NextResponse.json(
      { error: "Error procesando la invitacion" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invite
 * Lista invitaciones. Solo admin/owner.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const admin = createAdminClient();
    const { data, error: dbError } = await admin
      .from("invitations")
      .select("*, clients(full_name)")
      .order("invited_at", { ascending: false })
      .limit(100);

    if (dbError) throw dbError;
    return NextResponse.json(data ?? []);
  } catch (err) {
    captureError(err, "Invite GET");
    return NextResponse.json({ error: "Error obteniendo invitaciones" }, { status: 500 });
  }
}
