import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/error";

/**
 * GET /api/admin/stats
 * Operational stats for admin dashboard. Admin/owner only.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const admin = createAdminClient();

    // Parallel queries
    const [
      recentLogins,
      securityEvents,
      invitationsData,
      uploadsData,
      documentsData,
      clientsData,
      positionsCount,
    ] = await Promise.all([
      // Recent logins (last 20)
      admin
        .from("security_logs")
        .select("email, ip, action, success, created_at")
        .in("action", ["login_success", "login_failed", "login_blocked_rate_limit"])
        .order("created_at", { ascending: false })
        .limit(20),

      // Security events summary (last 7 days)
      admin
        .from("security_logs")
        .select("email, action, success, created_at")
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("created_at", { ascending: false }),

      // Invitations
      admin
        .from("invitations")
        .select("status, email, invited_at, confirmed_at")
        .order("invited_at", { ascending: false })
        .limit(50),

      // Recent uploads
      admin
        .from("uploads")
        .select("file_names, rows_inserted, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10),

      // Documents count
      admin
        .from("documents")
        .select("id, file_size, created_at")
        .order("created_at", { ascending: false })
        .limit(50),

      // Clients with auth
      admin
        .from("clients")
        .select("id, full_name, auth_user_id, email")
        .order("full_name"),

      // Total positions (for data volume)
      admin
        .from("positions")
        .select("id", { count: "exact", head: true }),
    ]);

    // Process security events
    const events = securityEvents.data ?? [];
    const loginSuccesses = events.filter((e) => e.action === "login_success").length;
    const loginFailures = events.filter((e) => e.action === "login_failed").length;
    const blockedIPs = events.filter((e) => e.action === "login_blocked_rate_limit").length;

    // Process invitations
    const invites = invitationsData.data ?? [];
    const pendingInvites = invites.filter((i) => i.status === "pending").length;
    const confirmedInvites = invites.filter((i) => i.status === "confirmed").length;

    // Process clients
    const clients = clientsData.data ?? [];
    const clientsWithAccess = clients.filter((c) => c.auth_user_id).length;
    const clientsWithoutAccess = clients.length - clientsWithAccess;

    // Process documents
    const docs = documentsData.data ?? [];
    const totalStorageBytes = docs.reduce((s, d) => s + (d.file_size ?? 0), 0);

    // Unique active users (last 7 days)
    const uniqueEmails = new Set(
      events
        .filter((e) => e.action === "login_success")
        .map((e) => e.email)
        .filter(Boolean)
    );

    return NextResponse.json({
      // KPIs
      activeUsersWeek: uniqueEmails.size,
      loginSuccesses7d: loginSuccesses,
      loginFailures7d: loginFailures,
      blockedIPs7d: blockedIPs,
      totalClients: clients.length,
      clientsWithAccess,
      clientsWithoutAccess,
      pendingInvites,
      confirmedInvites,
      totalPositions: positionsCount.count ?? 0,
      totalDocuments: docs.length,
      storageUsedMB: +(totalStorageBytes / (1024 * 1024)).toFixed(2),
      recentUploads: (uploadsData.data ?? []).length,

      // Tables
      recentLogins: (recentLogins.data ?? []).map((l) => ({
        email: l.email,
        ip: l.ip,
        action: l.action,
        success: l.success,
        date: l.created_at,
      })),
      recentDocuments: docs.slice(0, 10).map((d) => ({
        id: d.id,
        sizeMB: +((d.file_size ?? 0) / (1024 * 1024)).toFixed(2),
        date: d.created_at,
      })),
      invitations: invites.slice(0, 10).map((i) => ({
        email: i.email,
        status: i.status,
        invitedAt: i.invited_at,
        confirmedAt: i.confirmed_at,
      })),
    });
  } catch (err) {
    captureError(err, "Admin stats");
    return NextResponse.json({ error: "Error obteniendo estadisticas" }, { status: 500 });
  }
}
