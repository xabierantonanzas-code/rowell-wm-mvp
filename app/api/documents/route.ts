import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDocuments, getSignedUrl } from "@/lib/queries/documents";
import { sanitizeInput } from "@/lib/security";
import { captureError } from "@/lib/error";
import type { Document } from "@/lib/types/database";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_EXTENSIONS = new Set(["pdf", "xlsx", "xls", "doc", "docx", "jpg", "jpeg", "png"]);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const download = params.get("download");

  // Signed URL download — validate path doesn't traverse directories
  if (download) {
    if (download.includes("..") || download.startsWith("/")) {
      return NextResponse.json({ error: "Ruta invalida" }, { status: 400 });
    }
    try {
      const signedUrl = await getSignedUrl(download);
      return NextResponse.json({ url: signedUrl });
    } catch (err) {
      captureError(err, "Documents signed URL");
      return NextResponse.json(
        { error: "Error generando URL de descarga" },
        { status: 500 }
      );
    }
  }

  // List documents
  const clientId = params.get("clientId");
  if (!clientId || !UUID_REGEX.test(clientId)) {
    return NextResponse.json(
      { error: "clientId invalido" },
      { status: 400 }
    );
  }

  try {
    const docs = await getDocuments(clientId);

    const docsWithUrls: (Document & { signed_url: string | null })[] =
      await Promise.all(
        docs.map(async (doc) => {
          try {
            const signedUrl = await getSignedUrl(doc.file_path);
            return { ...doc, signed_url: signedUrl };
          } catch {
            return { ...doc, signed_url: null };
          }
        })
      );

    return NextResponse.json(docsWithUrls);
  } catch (err) {
    captureError(err, "Documents GET");
    return NextResponse.json(
      { error: "Error obteniendo documentos" },
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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientId = formData.get("client_id") as string | null;
    const name = formData.get("name") as string | null;
    const description = formData.get("description") as string | null;
    const docType = (formData.get("doc_type") as string | null) ?? "otro";

    if (!file || !clientId || !name) {
      return NextResponse.json(
        { error: "file, client_id y name son requeridos" },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(clientId)) {
      return NextResponse.json({ error: "client_id invalido" }, { status: 400 });
    }

    // Validate file extension
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Extension no permitida: .${ext}. Permitidas: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size (max 20MB)
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (fileBuffer.length > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Archivo demasiado grande (max 20MB)" }, { status: 400 });
    }

    const sanitizedName = sanitizeInput(name, 200);
    const sanitizedDesc = description ? sanitizeInput(description, 1000) : null;
    const filePath = `${clientId}/${docType}/${Date.now()}.${ext}`;

    // Upload to storage
    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      captureError(uploadErr, "Documents upload");
      return NextResponse.json(
        { error: "Error subiendo archivo" },
        { status: 500 }
      );
    }

    // Create record
    const { data: doc, error: dbErr } = await supabase
      .from("documents")
      .insert({
        client_id: clientId,
        uploaded_by: user.id,
        name: sanitizedName,
        description: sanitizedDesc,
        file_path: filePath,
        file_size: fileBuffer.length,
        doc_type: docType,
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    return NextResponse.json(doc);
  } catch (err) {
    captureError(err, "Documents POST");
    return NextResponse.json(
      { error: "Error subiendo documento" },
      { status: 500 }
    );
  }
}
