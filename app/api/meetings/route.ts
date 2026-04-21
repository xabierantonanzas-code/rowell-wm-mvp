import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRouteRateLimit } from "@/lib/security";
import { getMeetings, createMeeting } from "@/lib/queries/meetings";

export async function GET(req: NextRequest) {
  const rl = checkRouteRateLimit(req, "meetings", 100);
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json(
      { error: "clientId requerido" },
      { status: 400 }
    );
  }

  try {
    const meetings = await getMeetings(clientId);
    return NextResponse.json(meetings);
  } catch (err) {
    console.error("Error fetching meetings:", err);
    return NextResponse.json(
      { error: "Error obteniendo reuniones" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rl2 = checkRouteRateLimit(req, "meetings-post", 20);
  if (rl2) return rl2;

  try {
    const body = await req.json();
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}/;

    if (!body.client_id || !UUID_REGEX.test(body.client_id)) {
      return NextResponse.json({ error: "client_id invalido" }, { status: 400 });
    }
    if (!body.title || typeof body.title !== "string" || body.title.length > 500) {
      return NextResponse.json({ error: "title invalido (max 500 chars)" }, { status: 400 });
    }
    if (!body.meeting_date || !DATE_REGEX.test(body.meeting_date)) {
      return NextResponse.json({ error: "meeting_date invalido" }, { status: 400 });
    }

    const { sanitizeInput } = await import("@/lib/security");
    const meeting = await createMeeting({
      client_id: body.client_id,
      created_by: user.id,
      title: sanitizeInput(body.title, 500),
      meeting_date: body.meeting_date,
      summary: body.summary ? sanitizeInput(body.summary, 5000) : null,
      key_points: Array.isArray(body.key_points)
        ? body.key_points.filter((s: unknown) => typeof s === "string").map((s: string) => sanitizeInput(s, 1000))
        : null,
      agreed_actions: Array.isArray(body.agreed_actions)
        ? body.agreed_actions.filter((s: unknown) => typeof s === "string").map((s: string) => sanitizeInput(s, 1000))
        : null,
      next_meeting_date: body.next_meeting_date && DATE_REGEX.test(body.next_meeting_date) ? body.next_meeting_date : null,
    });

    // Auto-generate PDF
    try {
      const baseUrl = req.nextUrl.origin;
      await fetch(`${baseUrl}/api/meetings/generate-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ meetingId: meeting.id }),
      });
    } catch (pdfErr) {
      console.error("PDF generation failed (non-blocking):", pdfErr);
    }

    return NextResponse.json(meeting);
  } catch (err) {
    console.error("Error creating meeting:", err);
    return NextResponse.json(
      { error: "Error creando reunion" },
      { status: 500 }
    );
  }
}
