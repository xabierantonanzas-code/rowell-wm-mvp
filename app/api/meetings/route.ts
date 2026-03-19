import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMeetings, createMeeting } from "@/lib/queries/meetings";

export async function GET(req: NextRequest) {
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

  try {
    const body = await req.json();
    const meeting = await createMeeting({
      client_id: body.client_id,
      created_by: user.id,
      title: body.title,
      meeting_date: body.meeting_date,
      summary: body.summary ?? null,
      key_points: body.key_points ?? null,
      agreed_actions: body.agreed_actions ?? null,
      next_meeting_date: body.next_meeting_date ?? null,
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
