"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const ORG_ID = "913b770d-4eee-4c65-8f89-8781f6593b3a";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StructDept = {
  id: string;
  key: string;
  name: string;
  color: string;
  mission: string | null;
  staffCount: number;
  openTasks: number;
  doneTasks: number;
  perf: number;
};

export type StructSection = { dept_key: string; name: string };

export type StructRole = {
  id: string;
  dept_key: string;
  section_name: string | null;
  title: string;
  purpose: string | null;
  reports_to: string | null;
  qualifications: string | null;
  duties: string[];
  perms: string[];
  kpis: string[];
};

export type OrgStructure = {
  ok: boolean;
  depts: StructDept[];
  sections: StructSection[];
  roles: StructRole[];
  membersByDept: Record<string, number>;
};

function toStrArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
  if (raw && typeof raw === "object") return Object.values(raw as Record<string, unknown>).filter((x): x is string => typeof x === "string");
  return [];
}

function color(c: string | null): string {
  return c && c.toUpperCase() !== "#3B82F6" ? c : "#6366f1";
}

// ─── getOrgStructure ──────────────────────────────────────────────────────────

export async function getOrgStructure(): Promise<OrgStructure> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, depts: [], sections: [], roles: [], membersByDept: {} };

  const [depRes, secRes, roleRes, memRes] = await Promise.all([
    sb.from("org_departments").select("id,dept_key,name,color,mission,staff_count,open_tasks,done_tasks,perf,sort").eq("org_id", ORG_ID).eq("active", true).order("sort"),
    sb.from("org_sections").select("dept_key,name,sort").eq("org_id", ORG_ID).order("sort"),
    sb.from("org_roles").select("id,dept_key,section_name,title,purpose,reports_to,qualifications,duties,perms,kpis,sort").eq("org_id", ORG_ID).order("sort"),
    sb.from("dept_members").select("dept_key").eq("org_id", ORG_ID),
  ]);

  const depts: StructDept[] = (depRes.data ?? []).map((d) => ({
    id: d.id, key: d.dept_key, name: d.name, color: color(d.color), mission: d.mission,
    staffCount: d.staff_count ?? 0, openTasks: d.open_tasks ?? 0, doneTasks: d.done_tasks ?? 0, perf: d.perf ?? 0,
  }));

  const sections: StructSection[] = (secRes.data ?? []).map((s) => ({ dept_key: s.dept_key, name: s.name }));

  const roles: StructRole[] = (roleRes.data ?? []).map((r) => ({
    id: r.id, dept_key: r.dept_key, section_name: r.section_name, title: r.title,
    purpose: r.purpose, reports_to: r.reports_to, qualifications: r.qualifications,
    duties: toStrArray(r.duties), perms: toStrArray(r.perms), kpis: toStrArray(r.kpis),
  }));

  const membersByDept: Record<string, number> = {};
  for (const m of memRes.data ?? []) membersByDept[m.dept_key] = (membersByDept[m.dept_key] ?? 0) + 1;

  return { ok: true, depts, sections, roles, membersByDept };
}

// ─── getRoleById ──────────────────────────────────────────────────────────────

export async function getRoleById(id: string): Promise<{ ok: boolean; role?: StructRole & { deptName: string }; holders: { id: string; name: string; present: boolean }[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, holders: [] };

  const { data: r } = await sb.from("org_roles").select("id,dept_key,section_name,title,purpose,reports_to,qualifications,duties,perms,kpis").eq("id", id).maybeSingle();
  if (!r) return { ok: false, holders: [] };

  const [{ data: dept }, { data: members }] = await Promise.all([
    sb.from("org_departments").select("name").eq("org_id", ORG_ID).eq("dept_key", r.dept_key).maybeSingle(),
    sb.from("dept_members").select("id,full_name,job_title,present").eq("org_id", ORG_ID).eq("dept_key", r.dept_key),
  ]);

  const holders = (members ?? [])
    .filter((m) => (m.job_title ?? "").trim() === r.title.trim())
    .map((m) => ({ id: m.id, name: m.full_name, present: !!m.present }));

  return {
    ok: true,
    role: {
      id: r.id, dept_key: r.dept_key, section_name: r.section_name, title: r.title,
      purpose: r.purpose, reports_to: r.reports_to, qualifications: r.qualifications,
      duties: toStrArray(r.duties), perms: toStrArray(r.perms), kpis: toStrArray(r.kpis),
      deptName: dept?.name ?? r.dept_key,
    },
    holders,
  };
}

// ─── getSectionDetail ─────────────────────────────────────────────────────────

export async function getSectionDetail(id: string): Promise<{ ok: boolean; section?: { name: string; deptKey: string; deptName: string; deptColor: string }; members: { id: string; name: string; title: string; present: boolean }[]; roles: { id: string; title: string }[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, members: [], roles: [] };

  // id may be a section uuid or a "deptKey" fallback
  let sec = (await sb.from("org_sections").select("name,dept_key").eq("id", id).maybeSingle()).data as { name: string; dept_key: string } | null;
  if (!sec) {
    // fallback: treat id as dept_key, pick its first section
    sec = (await sb.from("org_sections").select("name,dept_key").eq("org_id", ORG_ID).eq("dept_key", id).order("sort").limit(1).maybeSingle()).data as { name: string; dept_key: string } | null;
  }
  if (!sec) return { ok: false, members: [], roles: [] };

  const [{ data: dept }, { data: members }, { data: roles }] = await Promise.all([
    sb.from("org_departments").select("name,color").eq("org_id", ORG_ID).eq("dept_key", sec.dept_key).maybeSingle(),
    sb.from("dept_members").select("id,full_name,job_title,present,section").eq("org_id", ORG_ID).eq("dept_key", sec.dept_key),
    sb.from("org_roles").select("id,title").eq("org_id", ORG_ID).eq("dept_key", sec.dept_key),
  ]);

  return {
    ok: true,
    section: { name: sec.name, deptKey: sec.dept_key, deptName: dept?.name ?? sec.dept_key, deptColor: color(dept?.color ?? null) },
    members: (members ?? []).map((m) => ({ id: m.id, name: m.full_name, title: m.job_title ?? "", present: !!m.present })),
    roles: (roles ?? []).map((r) => ({ id: r.id, title: r.title })),
  };
}

// ─── getReportsData ───────────────────────────────────────────────────────────

export async function getReportsData(): Promise<{
  ok: boolean;
  totals: { members: number; depts: number; openTasks: number; doneTasks: number; avgPerf: number };
  deptPerf: { name: string; perf: number; color: string }[];
  activity: { label: string; value: number }[];
}> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, totals: { members: 0, depts: 0, openTasks: 0, doneTasks: 0, avgPerf: 0 }, deptPerf: [], activity: [] };

  const [{ data: depts }, { count: memCount }, { count: svcCount }, { count: notifCount }, { count: meetCount }, { count: accessCount }, { count: formCount }] = await Promise.all([
    sb.from("org_departments").select("name,color,open_tasks,done_tasks,perf").eq("org_id", ORG_ID).eq("active", true).order("sort"),
    sb.from("dept_members").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID),
    sb.from("service_requests").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID),
    sb.from("notifications").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID),
    sb.from("appointments").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID),
    sb.from("data_access_requests").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID),
    sb.from("dept_form_entries").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID),
  ]);

  const d = depts ?? [];
  const openTasks = d.reduce((s, x) => s + (x.open_tasks ?? 0), 0);
  const doneTasks = d.reduce((s, x) => s + (x.done_tasks ?? 0), 0);
  const avgPerf = d.length ? Math.round(d.reduce((s, x) => s + (x.perf ?? 0), 0) / d.length) : 0;

  return {
    ok: true,
    totals: { members: memCount ?? 0, depts: d.length, openTasks, doneTasks, avgPerf },
    deptPerf: d.map((x) => ({ name: x.name, perf: x.perf ?? 0, color: color(x.color) })),
    activity: [
      { label: "طلبات الخدمة", value: svcCount ?? 0 },
      { label: "الإشعارات", value: notifCount ?? 0 },
      { label: "الاجتماعات", value: meetCount ?? 0 },
      { label: "طلبات الوصول", value: accessCount ?? 0 },
      { label: "النماذج المقدّمة", value: formCount ?? 0 },
    ],
  };
}

// ─── getServiceRequests ───────────────────────────────────────────────────────

export type ServiceReq = { id: string; category: string; faultType: string | null; details: string | null; status: string; time: string };

export async function getServiceRequests(): Promise<{ ok: boolean; requests: ServiceReq[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, requests: [] };
  const { data, error } = await sb.from("service_requests").select("id,category,fault_type,details,status,created_at").eq("org_id", ORG_ID).order("created_at", { ascending: false });
  if (error) return { ok: false, requests: [] };
  return {
    ok: true,
    requests: (data ?? []).map((r) => ({
      id: r.id, category: r.category, faultType: r.fault_type, details: r.details, status: r.status,
      time: new Date(r.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }),
    })),
  };
}

export async function createServiceRequest(input: { category: string; faultType?: string; details: string }): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const { error } = await sb.from("service_requests").insert({ org_id: ORG_ID, category: input.category, fault_type: input.faultType ?? null, details: input.details, status: "new" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ─── getForms ─────────────────────────────────────────────────────────────────

export type FormTemplate = { id: string; dept_key: string; title: string; description: string | null; fields: unknown[]; active: boolean };
export type FormEntry = { id: string; dept_key: string; title: string; status: string; doc_no: string | null; time: string };

export async function getForms(): Promise<{ ok: boolean; templates: FormTemplate[]; entries: FormEntry[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, templates: [], entries: [] };
  const [tRes, eRes] = await Promise.all([
    sb.from("dept_form_templates").select("id,dept_key,title,description,fields,active").eq("org_id", ORG_ID).order("sort"),
    sb.from("dept_form_entries").select("id,dept_key,title,status,doc_no,created_at").eq("org_id", ORG_ID).order("created_at", { ascending: false }),
  ]);
  return {
    ok: true,
    templates: (tRes.data ?? []).map((t) => ({ id: t.id, dept_key: t.dept_key, title: t.title, description: t.description, fields: Array.isArray(t.fields) ? t.fields : [], active: t.active ?? true })),
    entries: (eRes.data ?? []).map((e) => ({ id: e.id, dept_key: e.dept_key, title: e.title, status: e.status, doc_no: e.doc_no, time: new Date(e.created_at).toLocaleDateString("ar-SA", { dateStyle: "short" }) })),
  };
}

// ─── getWorkflowRules ─────────────────────────────────────────────────────────

export type WorkflowRule = { id: string; rule_key: string; enabled: boolean };

export async function getWorkflowRules(): Promise<{ ok: boolean; rules: WorkflowRule[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, rules: [] };
  const { data, error } = await sb.from("automation_rules").select("id,rule_key,enabled").eq("org_id", ORG_ID).order("created_at");
  if (error) return { ok: false, rules: [] };
  return { ok: true, rules: (data ?? []).map((r) => ({ id: r.id, rule_key: r.rule_key, enabled: !!r.enabled })) };
}

export async function toggleWorkflowRule(id: string, enabled: boolean): Promise<{ ok: boolean }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const { error } = await sb.from("automation_rules").update({ enabled }).eq("id", id);
  return { ok: !error };
}

// ─── getPermissionsData ───────────────────────────────────────────────────────

export type PermRef = { perm_key: string; label_ar: string };
export type PermSuspension = { id: string; scope: string; target: string; action: string; reason: string | null; time: string };

export async function getPermissionsData(): Promise<{ ok: boolean; catalog: PermRef[]; suspensions: PermSuspension[]; members: { id: string; name: string; dept_key: string; grantCount: number }[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, catalog: [], suspensions: [], members: [] };
  const [cRes, sRes, mRes] = await Promise.all([
    sb.from("dept_permissions_ref").select("perm_key,label_ar").order("perm_key"),
    sb.from("permission_suspensions").select("id,scope,target,action,reason,created_at").eq("org_id", ORG_ID).order("created_at", { ascending: false }),
    sb.from("dept_members").select("id,full_name,dept_key,perms").eq("org_id", ORG_ID),
  ]);
  const members = (mRes.data ?? []).map((m) => {
    const perms = m.perms;
    let grantCount = 0;
    if (Array.isArray(perms)) grantCount = perms.length;
    else if (perms && typeof perms === "object") grantCount = Object.values(perms as Record<string, unknown>).filter((g) => (g && typeof g === "object" ? (g as { granted?: boolean }).granted : g === true)).length;
    return { id: m.id, name: m.full_name, dept_key: m.dept_key, grantCount };
  });
  return {
    ok: true,
    catalog: (cRes.data ?? []) as PermRef[],
    suspensions: (sRes.data ?? []).map((s) => ({ id: s.id, scope: s.scope, target: s.target, action: s.action, reason: s.reason, time: new Date(s.created_at).toLocaleDateString("ar-SA", { dateStyle: "short" }) })),
    members,
  };
}

// ─── getAllAccessRequests (all statuses, for /access-requests) ─────────────────

export type AccessReqRow = { id: string; from: string; scope: string; reason: string | null; status: string; stage: number; totalStages: number; time: string };

export async function getAllAccessRequests(): Promise<{ ok: boolean; requests: AccessReqRow[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, requests: [] };
  const { data, error } = await sb
    .from("data_access_requests")
    .select("id,subject_ref,data_scope,reason,status,current_stage,total_stages,created_at")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, requests: [] };
  return {
    ok: true,
    requests: (data ?? []).map((r) => ({
      id: r.id, from: r.subject_ref ?? "موظف", scope: r.data_scope, reason: r.reason, status: r.status,
      stage: r.current_stage ?? 1, totalStages: r.total_stages ?? 1,
      time: new Date(r.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }),
    })),
  };
}

export async function decideAccessReq(id: string, decision: "approved" | "rejected"): Promise<{ ok: boolean }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const { error } = await sb.from("data_access_requests").update({ status: decision }).eq("id", id);
  return { ok: !error };
}

// ─── getGovernanceData ────────────────────────────────────────────────────────

export type AuditEntry = { id: string; action: string; table_name: string | null; actorName: string; detail: string; time: string };

export async function getGovernanceData(): Promise<{ ok: boolean; audits: AuditEntry[]; counts: { audits: number; approvals: number; suspensions: number; accessReqs: number } }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, audits: [], counts: { audits: 0, approvals: 0, suspensions: 0, accessReqs: 0 } };
  const [aRes, { count: apprCount }, { count: suspCount }, { count: accCount }] = await Promise.all([
    sb.from("audit_log").select("id,action,table_name,meta,created_at").eq("org_id", ORG_ID).order("created_at", { ascending: false }).limit(50),
    sb.from("approvals").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID),
    sb.from("permission_suspensions").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID),
    sb.from("data_access_requests").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID),
  ]);
  const audits = (aRes.data ?? []).map((a) => {
    const meta = (a.meta ?? {}) as { actor_name?: string; detail?: string };
    return { id: a.id, action: a.action, table_name: a.table_name, actorName: meta.actor_name ?? "النظام", detail: meta.detail ?? a.action, time: new Date(a.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) };
  });
  return { ok: true, audits, counts: { audits: audits.length, approvals: apprCount ?? 0, suspensions: suspCount ?? 0, accessReqs: accCount ?? 0 } };
}
