import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getMessages,
  createMessage,
  markMessagesRead,
} from "@/lib/queries/meetings";

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
    const messages = await getMessages(clientId);
    return NextResponse.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
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
    const message = await createMessage({
      client_id: body.client_id,
      sender_id: user.id,
      content: body.content,
      is_from_advisor: body.is_from_advisor ?? false,
    });
    return NextResponse.json(message);
  } catch (err) {
    console.error("Error creating message:", err);
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
    await markMessagesRead(body.client_id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error marking messages read:", err);
    return NextResponse.json(
      { error: "Error actualizando mensajes" },
      { status: 500 }
    );
  }
}
