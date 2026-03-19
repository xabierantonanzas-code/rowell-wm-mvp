import { createClient } from "@/lib/supabase/server";
import type { Document } from "@/lib/types/database";

export async function getDocuments(clientId: string): Promise<Document[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Document[];
}

export async function createDocument(
  data: Omit<Document, "id" | "created_at">
): Promise<Document> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("documents")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return row as Document;
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 3600);

  if (error) throw error;
  return data.signedUrl;
}
