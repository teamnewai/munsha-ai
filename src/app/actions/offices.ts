"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgIdOrFallback } from "@/lib/org-context";
import type { OfficeConfig, DashboardType } from "@/lib/officeConfig";

export interface OfficeSummary {
  id: string;
  kind: "human" | "ai";
  title: string;
  deptKey: string;
  deptName: string;
  deptColor: string;
  section: string | null;
  dashboardType: DashboardType;
  isHead: boolean;
  status: string;
}

export interface OfficeDetail extends OfficeSummary {
  config: OfficeConfig | null;
  responsibilities: string[];
  permissions: string[];
  kpis: string[];
  forms: { id: string; title: string }[];
}

function asConfig(raw: unknown): OfficeConfig | null {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (o.office && typeof o.office === "object") return o.office as OfficeConfig; // وكلاء: config.office
    if (o.sidebar) return raw as OfficeConfig; // موظفون: office_config مباشرة
  }
  return null;
}

// ─── قائمة جميع المكاتب واللوحات المُنشأة ────────────────────────────────────────

export async function getOffices(): Promise<{ ok: boolean; offices: OfficeSummary[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, offices: [] };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const [memRes, agentRes, deptRes] = await Promise.all([
    sb.from("dept_members").select("id,dept_key,full_name,job_title,role_in_dept,section,office_config,status").eq("org_id", ORG_ID),
    sb.from("ai_agents").select("id,dept_key,name,department,config,enabled").eq("org_id", ORG_ID),
    sb.from("org_departments").select("dept_key,name,color").eq("org_id", ORG_ID),
  ]);

  const deptMap = new Map((deptRes.data ?? []).map((d) => [d.dept_key, { name: d.name, color: d.color ?? "#6366f1" }]));

  const offices: OfficeSummary[] = [];

  for (const m of memRes.data ?? []) {
    const cfg = asConfig(m.office_config);
    const dept = deptMap.get(m.dept_key);
    offices.push({
      id: m.id, kind: "human", title: m.job_title || m.full_name,
      deptKey: m.dept_key, deptName: dept?.name ?? m.dept_key, deptColor: dept?.color ?? "#6366f1",
      section: m.section ?? null,
      dashboardType: cfg?.dashboardType ?? (m.role_in_dept === "head" ? "manager" : "employee"),
      isHead: m.role_in_dept === "head", status: m.status ?? "active",
    });
  }

  for (const a of agentRes.data ?? []) {
    const cfg = asConfig(a.config);
    const dept = deptMap.get(a.dept_key ?? "");
    offices.push({
      id: a.id, kind: "ai", title: a.name,
      deptKey: a.dept_key ?? "", deptName: dept?.name ?? a.department ?? "—", deptColor: dept?.color ?? "#9333ea",
      section: cfg?.section ?? null, dashboardType: "ai", isHead: false,
      status: a.enabled ? "active" : "disabled",
    });
  }

  // المدراء أولاً ثم حسب الإدارة
  offices.sort((a, b) => (a.isHead === b.isHead ? a.deptName.localeCompare(b.deptName) : a.isHead ? -1 : 1));

  return { ok: true, offices };
}

// ─── تفاصيل مكتب واحد ────────────────────────────────────────────────────────────

export async function getOfficeDetail(id: string): Promise<{ ok: boolean; office?: OfficeDetail }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  // جرّب موظف بشري أولاً
  const { data: m } = await sb.from("dept_members").select("id,dept_key,full_name,job_title,role_in_dept,section,office_config,perms,duties,status").eq("org_id", ORG_ID).eq("id", id).maybeSingle();

  let base: OfficeSummary | null = null;
  let cfg: OfficeConfig | null = null;
  let perms: string[] = [];
  let duties: string[] = [];

  const { data: deptRows } = await sb.from("org_departments").select("dept_key,name,color").eq("org_id", ORG_ID);
  const deptMap = new Map((deptRows ?? []).map((d) => [d.dept_key, { name: d.name, color: d.color ?? "#6366f1" }]));

  if (m) {
    cfg = asConfig(m.office_config);
    const dept = deptMap.get(m.dept_key);
    perms = Array.isArray(m.perms) ? (m.perms as string[]) : [];
    duties = Array.isArray(m.duties) ? (m.duties as string[]) : [];
    base = {
      id: m.id, kind: "human", title: m.job_title || m.full_name,
      deptKey: m.dept_key, deptName: dept?.name ?? m.dept_key, deptColor: dept?.color ?? "#6366f1",
      section: m.section ?? null, dashboardType: cfg?.dashboardType ?? (m.role_in_dept === "head" ? "manager" : "employee"),
      isHead: m.role_in_dept === "head", status: m.status ?? "active",
    };
  } else {
    const { data: a } = await sb.from("ai_agents").select("id,dept_key,name,department,persona,config,enabled").eq("org_id", ORG_ID).eq("id", id).maybeSingle();
    if (!a) return { ok: false };
    cfg = asConfig(a.config);
    const dept = deptMap.get(a.dept_key ?? "");
    perms = cfg?.permissions ?? [];
    duties = cfg?.responsibilities ?? [];
    base = {
      id: a.id, kind: "ai", title: a.name,
      deptKey: a.dept_key ?? "", deptName: dept?.name ?? a.department ?? "—", deptColor: dept?.color ?? "#9333ea",
      section: cfg?.section ?? null, dashboardType: "ai", isHead: false,
      status: a.enabled ? "active" : "disabled",
    };
  }

  // نماذج الإدارة المرتبطة بالمكتب
  const { data: forms } = await sb.from("dept_form_templates").select("id,title").eq("org_id", ORG_ID).eq("dept_key", base.deptKey).eq("active", true).order("sort");

  return {
    ok: true,
    office: {
      ...base,
      config: cfg,
      responsibilities: cfg?.responsibilities ?? duties,
      permissions: cfg?.permissions ?? perms,
      kpis: cfg?.kpis ?? [],
      forms: (forms ?? []).map((f) => ({ id: f.id, title: f.title })),
    },
  };
}
