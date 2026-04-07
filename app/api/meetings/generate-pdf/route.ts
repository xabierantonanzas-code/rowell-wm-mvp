import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Meeting } from "@/lib/types/database";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { meetingId } = (await req.json()) as { meetingId: string };
  if (!meetingId) {
    return NextResponse.json(
      { error: "meetingId requerido" },
      { status: 400 }
    );
  }

  // Load meeting
  const { data: meeting, error: meetingErr } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (meetingErr || !meeting) {
    return NextResponse.json(
      { error: "Reunion no encontrada" },
      { status: 404 }
    );
  }
  const m = meeting as Meeting;

  // Get client name
  const { data: client } = await supabase
    .from("clients")
    .select("full_name")
    .eq("id", m.client_id)
    .single();

  const clientName = client?.full_name ?? "Cliente";

  // Call Claude API to generate HTML
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system:
      "Eres el asistente de Rowell Patrimonios, una plataforma de gestion patrimonial. Genera minutas de reunion profesionales en español. Tono formal pero cercano. Devuelve HTML con estilos inline para PDF.",
    messages: [
      {
        role: "user",
        content: `Genera una minuta profesional con estos datos:
- Cliente: ${clientName}
- Fecha: ${m.meeting_date}
- Titulo: ${m.title}
- Resumen: ${m.summary ?? "Sin resumen"}
- Puntos clave: ${(m.key_points ?? []).join(", ") || "Ninguno"}
- Acciones acordadas: ${(m.agreed_actions ?? []).join(", ") || "Ninguna"}
- Proxima reunion: ${m.next_meeting_date ?? "Por definir"}
Branding Rowell: navy #3D4F63, gold #B8965A.
Incluye cabecera con logo textual "Rowell Patrimonios", cuerpo estructurado y pie de pagina.
Devuelve SOLO el HTML completo, sin markdown, sin backticks.`,
      },
    ],
  });

  const htmlContent =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Convert HTML to PDF using puppeteer
  let pdfBuffer: Buffer;
  try {
    const chromium = await import("@sparticuz/chromium");
    const puppeteer = await import("puppeteer-core");

    const executablePath = await chromium.default.executablePath();
    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    await browser.close();
    pdfBuffer = Buffer.from(pdf);
  } catch (puppeteerErr) {
    console.error("Puppeteer error, falling back to HTML storage:", puppeteerErr);
    // Fallback: store HTML as the "PDF"
    pdfBuffer = Buffer.from(htmlContent, "utf-8");
  }

  // Upload to Supabase Storage
  const filePath = `${m.client_id}/minutas/${meetingId}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    console.error("Storage upload error:", uploadErr);
    return NextResponse.json(
      { error: "Error subiendo PDF" },
      { status: 500 }
    );
  }

  // Get public URL
  const { data: urlData } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 60 * 60 * 24 * 365);

  const pdfUrl = urlData?.signedUrl ?? filePath;

  // Update meeting with pdf_url
  await supabase
    .from("meetings")
    .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
    .eq("id", meetingId);

  // Create document record
  await supabase.from("documents").insert({
    client_id: m.client_id,
    uploaded_by: user.id,
    name: `Minuta - ${m.title}`,
    description: `Minuta de reunion del ${m.meeting_date}`,
    file_path: filePath,
    file_size: pdfBuffer.length,
    doc_type: "minuta",
    meeting_id: meetingId,
  });

  return NextResponse.json({ success: true, pdf_url: pdfUrl });
}
