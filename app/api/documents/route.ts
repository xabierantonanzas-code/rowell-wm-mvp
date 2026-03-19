import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDocuments, getSignedUrl } from "@/lib/queries/documents";
import type { Document } from "@/lib/types/database";

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

  // Signed URL download
  if (download) {
    try {
      const signedUrl = await getSignedUrl(download);
      return NextResponse.json({ url: signedUrl });
    } catch (err) {
      console.error("Error generating signed URL:", err);
      return NextResponse.json(
        { error: "Error generando URL de descarga" },
        { status: 500 }
      );
    }
  }

  // List documents
  const clientId = params.get("clientId");
  if (!clientId) {
    return NextResponse.json(
      { error: "clientId requerido" },
      { status: 400 }
    );
  }

  try {
    const docs = await getDocuments(clientId);

    // Generate signed URLs for each document
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
    console.error("Error fetching documents:", err);
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

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() ?? "pdf";
    const filePath = `${clientId}/${docType}/${Date.now()}.${ext}`;

    // Upload to storage
    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
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
        name,
        description,
        file_path: filePath,
        file_size: fileBuffer.length,
        doc_type: docType,
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    return NextResponse.json(doc);
  } catch (err) {
    console.error("Error uploading document:", err);
    return NextResponse.json(
      { error: "Error subiendo documento" },
      { status: 500 }
    );
  }
}
