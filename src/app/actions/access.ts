"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// إجراءات خادمية فعلية لإدارة صلاحيات الموظفين (dept_members.perms / suspended)

export type Grant = { granted: boolean; delegate: boolean };
export type PermMap = Record<string, Grant>;
export type RealMember = { id: string; name: string; role: string; suspended: boolean; perms: PermMap };
export type RealGroup = { deptKey: string; deptName: string; color: string; members: RealMember[] };

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
  const [depRes, memRes] = await Promise.all([
    sb.from("org_departments").select("dept_key,name,color").eq("active", true).order("sort"),
    sb.from("dept_members").select("id,full_name,job_title,role_in_dept,dept_key,perms,suspended").order("role_in_dept"),
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
  const { error } = await sb.from("dept_members").update({ perms }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setMemberSuspended(id: string, suspended: boolean): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const { error } = await sb
    .from("dept_members")
    .update({ suspended, status: suspended ? "suspended" : "active", suspended_at: suspended ? new Date().toISOString() : null })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
