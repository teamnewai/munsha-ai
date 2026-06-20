"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgIdOrFallback } from "@/lib/org-context";

export type Grant = { granted: boolean; delegate: boolean };
export type PermMap = Record<string, Grant>;
export type RealMember = { id: string; name: string; email?: string; role: string; suspended: boolean; perms: PermMap };
export type RealGroup = { deptKey: string; deptName: string; color: string; members: RealMember[] };
export type RealAccessRequest = { id: string; from: string; scope: string; reason: string; status: string; time: string };
export type SecretaryMessage = { id: string; from: string; subject: string; body: string; time: string };

// تطبيع شكل perms (قد يكون مصفوفة قديمة أو كائناً)
function normalizePerms(raw: unknown): PermMap {
  if (Array.isArray(raw)) {
    const m: PermMap = {};
    for (const k of raw) if (typeof k === "string") m[k] = { granted: true, delegate: false };
    return m;
  }
  if (raw && typeof raw === "object") {
    const m: PermMap = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v && typeof v === "object") {
        const g = v as { granted?: boolean; delegate?: boolean };
        m[k] = { granted: !!g.granted, delegate: !!g.delegate };
      } else if (v === true) m[k] = { granted: true, delegate: false };
    }
    return m;
  }
  return {};
}

export async function getOrgGroups(): Promise<{ ok: boolean; groups: RealGroup[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, groups: [] };
  const ORG_ID = await getCurrentOrgIdOrFallback();
  const [depRes, memRes] = await Promise.all([
    sb.from("org_departments").select("dept_key,name,color").eq("org_id", ORG_ID).eq("active", true).order("sort"),
    sb.from("dept_members").select("id,full_name,job_title,role_in_dept,dept_key,perms,suspended").eq("org_id", ORG_ID).order("role_in_dept"),
  ]);
  const deps = (depRes.data ?? []) as { dept_key: string; name: string; color: string | null }[];
  const mems = (memRes.data ?? []) as {
    id: string; full_name: string; job_title: string | null; role_in_dept: string; dept_key: string; perms: unknown; suspended: boolean;
  }[];

  const groups: RealGroup[] = deps.map((d) => ({
    deptKey: d.dept_key,
    deptName: d.name,
    color: d.color && d.color.toUpperCase() !== "#3B82F6" ? d.color : "#6366f1",
    members: mems
      .filter((m) => m.dept_key === d.dept_key)
      .map((m) => ({
        id: m.id,
        name: m.full_name,
        role: m.job_title || (m.role_in_dept === "head" ? "مدير الإدارة" : "موظف"),
        suspended: !!m.suspended,
        perms: normalizePerms(m.perms),
      })),
  }));
  return { ok: true, groups };
}

export async function setMemberPerms(id: string, perms: PermMap): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const ORG_ID = await getCurrentOrgIdOrFallback();
  const { error } = await sb.from("dept_members").update({ perms }).eq("id", id).eq("org_id", ORG_ID);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setMemberSuspended(id: string, suspended: boolean): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const ORG_ID = await getCurrentOrgIdOrFallback();
  const { error } = await sb
    .from("dept_members")
    .update({ suspended, status: suspended ? "suspended" : "active", suspended_at: suspended ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("org_id", ORG_ID);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getMemberById(id: string): Promise<{ ok: boolean; member?: RealMember & { dept: string; color: string } }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const ORG_ID = await getCurrentOrgIdOrFallback();
  const [memRes, deptRes] = await Promise.all([
    sb.from("dept_members").select("id,full_name,email,job_title,role_in_dept,dept_key,perms,suspended").eq("id", id).eq("org_id", ORG_ID).maybeSingle(),
    sb.from("org_departments").select("dept_key,name,color").eq("org_id", ORG_ID).eq("active", true),
  ]);
  if (!memRes.data) return { ok: false };
  const m = memRes.data as { id: string; full_name: string; email?: string; job_title: string | null; role_in_dept: string; dept_key: string; perms: unknown; suspended: boolean };
  const depts = (deptRes.data ?? []) as { dept_key: string; name: string; color: string | null }[];
  const dept = depts.find((d) => d.dept_key === m.dept_key);
  return {
    ok: true,
    member: {
      id: m.id,
      name: m.full_name,
      email: m.email ?? undefined,
      role: m.job_title || (m.role_in_dept === "head" ? "مدير الإدارة" : "موظف"),
      suspended: !!m.suspended,
      perms: normalizePerms(m.perms),
      dept: dept?.name ?? m.dept_key,
      color: dept?.color && dept.color.toUpperCase() !== "#3B82F6" ? dept.color : "#6366f1",
    },
  };
}

export async function getAccessRequests(): Promise<{ ok: boolean; requests: RealAccessRequest[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, requests: [] };
  const ORG_ID = await getCurrentOrgIdOrFallback();
  const { data, error } = await sb
    .from("data_access_requests")
    .select("id,subject_ref,data_scope,reason,status,created_at")
    .eq("org_id", ORG_ID)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, requests: [] };
  return {
    ok: true,
    requests: (data ?? []).map((r: { id: string; subject_ref: string | null; data_scope: string; reason: string; status: string; created_at: string }) => ({
      id: r.id,
      from: r.subject_ref ?? "موظف",
      scope: r.data_scope,
      reason: r.reason,
      status: r.status,
      time: new Date(r.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }),
    })),
  };
}

export async function createAccessRequest(input: { from: string; scope: string; reason: string }): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const ORG_ID = await getCurrentOrgIdOrFallback();
  const { error } = await sb.from("data_access_requests").insert({
    org_id: ORG_ID,
    subject_ref: input.from,
    data_scope: input.scope,
    reason: input.reason,
    status: "pending",
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function decideAccessRequest(id: string, decision: "approved" | "rejected"): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const ORG_ID = await getCurrentOrgIdOrFallback();
  const { error } = await sb.from("data_access_requests").update({ status: decision }).eq("id", id).eq("org_id", ORG_ID);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getSecretaryMessages(): Promise<{ ok: boolean; messages: SecretaryMessage[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, messages: [] };
  const ORG_ID = await getCurrentOrgIdOrFallback();
  const { data, error } = await sb
    .from("secretary_reports")
    .select("id,data,narrative,created_at")
    .eq("org_id", ORG_ID)
    .eq("period", "message")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { ok: false, messages: [] };
  return {
    ok: true,
    messages: (data ?? []).map((r: { id: string; data: Record<string, string>; narrative: string | null; created_at: string }) => ({
      id: r.id,
      from: r.data?.from ?? "موظف",
      subject: r.narrative ?? r.data?.subject ?? "",
      body: r.data?.body ?? "",
      time: new Date(r.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }),
    })),
  };
}

export async function sendSecretaryMessage(input: { from: string; subject: string; body: string }): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const ORG_ID = await getCurrentOrgIdOrFallback();
  const { error } = await sb.from("secretary_reports").insert({
    org_id: ORG_ID,
    period: "message",
    data: { from: input.from, subject: input.subject, body: input.body },
    narrative: input.subject,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
