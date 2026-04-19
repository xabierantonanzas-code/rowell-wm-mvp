import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRouteRateLimit } from "@/lib/security";
import {
  getMessages,
  createMessage,
  markMessagesRead,
} from "@/lib/queries/meetings";
import { sanitizeInput } from "@/lib/security";
import { captureError } from "@/lib/error";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const rl = checkRouteRateLimit(req, "messages", 100);
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId || !UUID_REGEX.test(clientId)) {
    return NextResponse.json(
      { error: "clientId invalido" },
      { status: 400 }
    );
  }

  try {
    const messages = await getMessages(clientId);
    return NextResponse.json(messages);
  } catch (err) {
    captureError(err, "Messages GET");
    return NextResponse.json(
      { error: "Error obteniendo mensajes" },
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

    const clientId = body.client_id;
    const content = sanitizeInput(body.content ?? "", 5000);

    if (!clientId || !UUID_REGEX.test(clientId)) {
      return NextResponse.json({ error: "client_id invalido" }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: "Contenido requerido" }, { status: 400 });
    }

    const message = await createMessage({
      client_id: clientId,
      sender_id: user.id,
      content,
      is_from_advisor: body.is_from_advisor ?? false,
    });
    return NextResponse.json(message);
  } catch (err) {
    captureError(err, "Messages POST");
    return NextResponse.json(
      { error: "Error creando mensaje" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const clientId = body.client_id;

    if (!clientId || !UUID_REGEX.test(clientId)) {
      return NextResponse.json({ error: "client_id invalido" }, { status: 400 });
    }

    await markMessagesRead(clientId);
    return NextResponse.json({ success: true });
  } catch (err) {
    captureError(err, "Messages PATCH");
    return NextResponse.json(
      { error: "Error actualizando mensajes" },
      { status: 500 }
    );
  }
}
