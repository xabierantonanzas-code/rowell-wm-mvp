import { createClient } from "@/lib/supabase/server";
import type { Meeting, Message } from "@/lib/types/database";

// ===========================================================================
// Meetings
// ===========================================================================

export async function getMeetings(clientId: string): Promise<Meeting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("client_id", clientId)
    .order("meeting_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Meeting[];
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as Meeting) ?? null;
}

export async function createMeeting(
  data: Omit<Meeting, "id" | "created_at" | "updated_at" | "pdf_url">
): Promise<Meeting> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("meetings")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return row as Meeting;
}

export async function updateMeeting(
  id: string,
  updates: Partial<Meeting>
): Promise<Meeting> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("meetings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return row as Meeting;
}

// ===========================================================================
// Messages
// ===========================================================================

export async function getMessages(clientId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function createMessage(
  data: Omit<Message, "id" | "created_at" | "read_at">
): Promise<Message> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("messages")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return row as Message;
}

export async function markMessagesRead(clientId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .is("read_at", null)
    .eq("is_from_advisor", true);

  if (error) throw error;
}
