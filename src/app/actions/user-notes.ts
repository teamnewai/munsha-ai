"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/org-context";

export type NoteRow = { id: string; content: string; createdAt: string };

export async function getUserNotes(): Promise<{ ok: boolean; notes: NoteRow[] }> {
  const client = await createClient();
  if (!client) return { ok: false, notes: [] };
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false, notes: [] };

  const { data, error } = await client
    .from("user_notes")
    .select("id,content,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { ok: false, notes: [] };
  return {
    ok: true,
    notes: (data ?? []).map((n) => ({ id: n.id, content: n.content, createdAt: n.created_at })),
  };
}

export async function addUserNote(content: string): Promise<{ ok: boolean; error?: string; note?: NoteRow }> {
  const client = await createClient();
  if (!client) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false, error: "غير مسجّل الدخول" };

  const orgId = await getCurrentOrgId();

  const { data, error } = await client
    .from("user_notes")
    .insert({ user_id: user.id, org_id: orgId ?? null, content: content.trim() })
    .select("id,content,created_at")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, note: { id: data.id, content: data.content, createdAt: data.created_at } };
}

export async function deleteUserNote(id: string): Promise<{ ok: boolean }> {
  const client = await createClient();
  if (!client) return { ok: false };
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await client
    .from("user_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return { ok: !error };
}
