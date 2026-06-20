"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";

export type TaskPriority = "عالية" | "متوسطة" | "منخفضة";
export type TaskStatus = "جديدة" | "جارية" | "مكتملة" | "معلّقة";

export type TaskRow = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  done: boolean;
  createdAt: string;
};

export async function getTasks(statusFilter?: TaskStatus): Promise<{ ok: boolean; tasks: TaskRow[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, tasks: [] };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: true, tasks: [] };

  let q = sb
    .from("org_tasks")
    .select("id,title,description,priority,status,due_date,done,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (statusFilter) q = q.eq("status", statusFilter);

  const { data, error } = await q;
  if (error) return { ok: false, tasks: [] };

  return {
    ok: true,
    tasks: (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      priority: (t.priority as TaskPriority) ?? "متوسطة",
      status: (t.status as TaskStatus) ?? "جديدة",
      dueDate: t.due_date ?? null,
      done: t.done ?? false,
      createdAt: t.created_at,
    })),
  };
}

export async function addTask(input: {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
}): Promise<{ ok: boolean; error?: string; task?: TaskRow }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false, error: "لا توجد منشأة مرتبطة بحسابك" };

  const client = await createClient();
  const userId = client ? (await client.auth.getUser()).data.user?.id ?? null : null;

  const { data, error } = await sb
    .from("org_tasks")
    .insert({
      org_id: orgId,
      created_by: userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority ?? "متوسطة",
      due_date: input.dueDate || null,
      status: "جديدة",
    })
    .select("id,title,description,priority,status,due_date,done,created_at")
    .single();

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    task: {
      id: data.id,
      title: data.title,
      description: data.description ?? "",
      priority: (data.priority as TaskPriority) ?? "متوسطة",
      status: (data.status as TaskStatus) ?? "جديدة",
      dueDate: data.due_date ?? null,
      done: data.done ?? false,
      createdAt: data.created_at,
    },
  };
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<{ ok: boolean }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false };

  const done = status === "مكتملة";
  const { error } = await sb
    .from("org_tasks")
    .update({ status, done, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);

  return { ok: !error };
}

export async function toggleTaskDone(id: string, done: boolean): Promise<{ ok: boolean }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false };

  const status: TaskStatus = done ? "مكتملة" : "جارية";
  const { error } = await sb
    .from("org_tasks")
    .update({ done, status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);

  return { ok: !error };
}

export async function deleteTask(id: string): Promise<{ ok: boolean }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false };

  const { error } = await sb
    .from("org_tasks")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  return { ok: !error };
}
