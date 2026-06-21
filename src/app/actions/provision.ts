"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/org-context";
import { getDeptTemplate, type DeptTemplate } from "@/lib/orgTemplates";
import { buildOfficeConfig, dashboardTypeFor, type DashboardType } from "@/lib/officeConfig";
import type { DeptKey } from "@/lib/deptMeta";

// ─── أنواع المعاينة ─────────────────────────────────────────────────────────────

export interface StructurePreview {
  depts: { key: string; name: string; icon: string; color: string; mission: string; sectionCount: number; roleCount: number; aiCount: number; formCount: number; workflowCount: number }[];
  totals: {
    depts: number; sections: number; roles: number; humans: number; ai: number;
    permissions: number; forms: number; workflows: number; kpis: number; dashboards: number; offices: number;
  };
}

interface AuthCtx { orgId: string; userId: string | null; isOwner: boolean }

async function resolveAuth(): Promise<{ ok: true; ctx: AuthCtx } | { ok: false; error: string }> {
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false, error: "لا توجد منشأة مرتبطة بحسابك. أنشئ منشأتك أولاً." };

  const sb = await createClient();
  const userId = sb ? (await sb.auth.getUser()).data.user?.id ?? null : null;

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "قاعدة البيانات غير مهيّأة." };

  let isOwner = false;
  if (userId) {
    const { data } = await admin.from("memberships").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
    isOwner = ["owner", "admin"].includes((data?.role ?? "").toLowerCase());
  }
  return { ok: true, ctx: { orgId, userId, isOwner } };
}

function buildTemplates(deptKeys: DeptKey[]): DeptTemplate[] {
  return deptKeys.map(getDeptTemplate).filter(Boolean);
}

function summarize(tpls: DeptTemplate[]): StructurePreview {
  const allPerms = new Set<string>();
  const allKpis = new Set<string>();
  let sections = 0, roles = 0, humans = 0, ai = 0, forms = 0, workflows = 0;
  const depts = tpls.map((t) => {
    const aiRoles = t.roles.filter((r) => r.assignee === "ai");
    const humanRoles = t.roles.filter((r) => r.assignee === "human");
    sections += t.sections.length;
    roles += t.roles.length;
    humans += humanRoles.length;
    ai += aiRoles.length;
    forms += t.forms.length;
    workflows += t.workflows.length;
    t.roles.forEach((r) => { r.perms.forEach((p) => allPerms.add(p)); r.kpis.forEach((k) => allKpis.add(k)); });
    return {
      key: t.key, name: t.name, icon: t.icon, color: t.color, mission: t.mission,
      sectionCount: t.sections.length, roleCount: t.roles.length, aiCount: aiRoles.length,
      formCount: t.forms.length, workflowCount: t.workflows.length,
    };
  });
  const dashboards = humans + ai; // كل دور بشري أو وكيل ⇒ لوحة + مكتب
  return {
    depts,
    totals: {
      depts: tpls.length, sections, roles, humans, ai,
      permissions: allPerms.size, forms, workflows, kpis: allKpis.size,
      dashboards, offices: dashboards,
    },
  };
}

// ─── معاينة الهيكل المقترح (تُحفظ كمسودة) ────────────────────────────────────────

export async function generateStructurePreview(input: {
  deptKeys: DeptKey[];
  activity?: string;
  clientType?: string;
  country?: string;
  headcount?: number;
}): Promise<{ ok: boolean; preview?: StructurePreview; error?: string }> {
  const auth = await resolveAuth();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { ctx } = auth;

  const tpls = buildTemplates(input.deptKeys);
  if (tpls.length === 0) return { ok: false, error: "اختر إدارة واحدة على الأقل." };
  const preview = summarize(tpls);

  const admin = createAdminClient()!;
  await admin.from("org_structure_docs").insert({
    org_id: ctx.orgId,
    source: "builder-draft",
    input: { deptKeys: input.deptKeys, activity: input.activity ?? null, clientType: input.clientType ?? null, country: input.country ?? null, headcount: input.headcount ?? null },
    structure: preview as unknown as Record<string, unknown>,
  });

  return { ok: true, preview };
}

// ─── الإنشاء التلقائي الكامل بعد اعتماد المالك ───────────────────────────────────

export interface ProvisionResult {
  ok: boolean;
  error?: string;
  summary?: {
    departments: number; sections: number; roles: number; humanOffices: number; aiOffices: number;
    forms: number; workflows: number; permissions: number; kpis: number; dashboards: number;
  };
}

export async function provisionOrgStructure(input: {
  deptKeys: DeptKey[];
  activity?: string;
  clientType?: string;
  country?: string;
  headcount?: number;
}): Promise<ProvisionResult> {
  const auth = await resolveAuth();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { ctx } = auth;
  if (!ctx.isOwner) return { ok: false, error: "اعتماد الهيكل وإنشاؤه يتطلب صلاحية مالك أو مدير المنشأة." };

  const tpls = buildTemplates(input.deptKeys);
  if (tpls.length === 0) return { ok: false, error: "اختر إدارة واحدة على الأقل." };

  const admin = createAdminClient()!;
  const orgId = ctx.orgId;

  // اجلب الموجود لضمان عدم التكرار (idempotent)
  const [existDeptsRes, existSecsRes, existRolesRes, existMembersRes, existAgentsRes, existFormsRes, existRulesRes] = await Promise.all([
    admin.from("org_departments").select("dept_key").eq("org_id", orgId),
    admin.from("org_sections").select("dept_key,name").eq("org_id", orgId),
    admin.from("org_roles").select("dept_key,title").eq("org_id", orgId),
    admin.from("dept_members").select("dept_key,job_title").eq("org_id", orgId),
    admin.from("ai_agents").select("name").eq("org_id", orgId),
    admin.from("dept_form_templates").select("dept_key,title").eq("org_id", orgId),
    admin.from("automation_rules").select("rule_key").eq("org_id", orgId),
  ]);

  const existDepts = new Set((existDeptsRes.data ?? []).map((d) => d.dept_key));
  const existSecs = new Set((existSecsRes.data ?? []).map((s) => `${s.dept_key}::${s.name}`));
  const existRoles = new Set((existRolesRes.data ?? []).map((r) => `${r.dept_key}::${r.title}`));
  const existMembers = new Set((existMembersRes.data ?? []).map((m) => `${m.dept_key}::${m.job_title}`));
  const existAgents = new Set((existAgentsRes.data ?? []).map((a) => a.name));
  const existForms = new Set((existFormsRes.data ?? []).map((f) => `${f.dept_key}::${f.title}`));
  const existRules = new Set((existRulesRes.data ?? []).map((r) => r.rule_key));

  const allPerms = new Set<string>();
  const allKpis = new Set<string>();
  const counters = { departments: 0, sections: 0, roles: 0, humanOffices: 0, aiOffices: 0, forms: 0, workflows: 0 };

  for (let di = 0; di < tpls.length; di++) {
    const t = tpls[di];

    // 1) الإدارة
    if (!existDepts.has(t.key)) {
      await admin.from("org_departments").insert({
        org_id: orgId, dept_key: t.key, name: t.name, icon: t.icon, color: t.color,
        operation_type: t.operationType, mission: t.mission, sort: di,
        staff_count: 0, open_tasks: 0, done_tasks: 0, perf: 0, active: true,
      });
      counters.departments++;
    } else {
      await admin.from("org_departments").update({ name: t.name, icon: t.icon, color: t.color, mission: t.mission, active: true }).eq("org_id", orgId).eq("dept_key", t.key);
    }

    // 2) الأقسام
    const secsToAdd = t.sections.filter((s) => !existSecs.has(`${t.key}::${s}`));
    if (secsToAdd.length) {
      await admin.from("org_sections").insert(secsToAdd.map((name, i) => ({ org_id: orgId, dept_key: t.key, name, sort: i })));
      counters.sections += secsToAdd.length;
    }

    // 3) المسميات الوظيفية (بواجباتها وصلاحياتها ومؤشراتها) + 4/5) الموظفون والوكلاء + مكاتبهم
    for (let ri = 0; ri < t.roles.length; ri++) {
      const r = t.roles[ri];
      r.perms.forEach((p) => allPerms.add(p));
      r.kpis.forEach((k) => allKpis.add(k));

      // org_roles
      if (!existRoles.has(`${t.key}::${r.title}`)) {
        await admin.from("org_roles").insert({
          org_id: orgId, dept_key: t.key, section_name: r.section, title: r.title,
          purpose: r.purpose, reports_to: r.reportsTo, qualifications: r.qualifications,
          duties: r.duties, perms: r.perms, kpis: r.kpis, sort: ri,
        });
        counters.roles++;
      }

      const officeConfig = buildOfficeConfig({
        title: r.title, assignee: r.assignee, isHead: r.isHead,
        deptKey: t.key, deptName: t.name, section: r.section,
        duties: r.duties, perms: r.perms, kpis: r.kpis,
      });

      if (r.assignee === "ai") {
        // 5) وكيل ذكاء اصطناعي + لوحة + مكتب (يُخزَّن office_config في config)
        if (!existAgents.has(r.title)) {
          await admin.from("ai_agents").insert({
            org_id: orgId, scope: "role", dept_key: t.key, name: r.title,
            persona: r.purpose, department: t.name, enabled: true,
            autonomy: "supervised", training_status: "ready", docs_count: 0,
            config: { office: officeConfig },
            guardrails: { requires_human_approval: true, jurisdiction: input.country ?? "SA" },
            tools: [],
          });
          counters.aiOffices++;
        }
      } else {
        // 4) موظف بشري (وظيفة شاغرة جاهزة للإسناد) + لوحة + مكتب
        if (!existMembers.has(`${t.key}::${r.title}`)) {
          await admin.from("dept_members").insert({
            org_id: orgId, dept_key: t.key, full_name: r.title, job_title: r.title,
            role_in_dept: r.isHead ? "head" : "member", section: r.section,
            perms: r.perms, duties: r.duties, office_config: officeConfig,
            can_enter: true, present: false, suspended: false, status: "vacant",
          });
          counters.humanOffices++;
        }
      }
    }

    // 6) النماذج
    const formsToAdd = t.forms.filter((f) => !existForms.has(`${t.key}::${f.title}`));
    if (formsToAdd.length) {
      await admin.from("dept_form_templates").insert(formsToAdd.map((f, i) => ({
        org_id: orgId, dept_key: t.key, title: f.title, description: f.description,
        fields: f.fields, is_builtin: true, sort: i, active: true,
      })));
      counters.forms += formsToAdd.length;
    }

    // 7) سير العمل والدورات المستندية (automation_rules + التفاصيل في structure doc)
    const rulesToAdd = t.workflows.filter((w) => !existRules.has(w.ruleKey));
    if (rulesToAdd.length) {
      await admin.from("automation_rules").insert(rulesToAdd.map((w) => ({ org_id: orgId, rule_key: w.ruleKey, enabled: true })));
      counters.workflows += rulesToAdd.length;
    }

    // حدّث عدد الموظفين على الإدارة
    const deptHeadcount = t.roles.length;
    await admin.from("org_departments").update({ staff_count: deptHeadcount }).eq("org_id", orgId).eq("dept_key", t.key);
  }

  // 8) فعّل مكتب المنشأة واستراتيجية اللوحات
  const { data: officeRow } = await admin.from("org_office").select("org_id").eq("org_id", orgId).maybeSingle();
  if (officeRow) {
    await admin.from("org_office").update({ setup_done: true, dashboard_strategy: "per_role" }).eq("org_id", orgId);
  } else {
    await admin.from("org_office").insert({ org_id: orgId, setup_done: true, dashboard_strategy: "per_role", secretary_enabled: true, strict_mode: false });
  }

  // وثيقة الهيكل المعتمدة + سجل التدقيق
  const preview = summarize(tpls);
  await admin.from("org_structure_docs").insert({
    org_id: orgId, source: "builder-approved",
    input: { deptKeys: input.deptKeys, activity: input.activity ?? null, clientType: input.clientType ?? null, country: input.country ?? null, headcount: input.headcount ?? null },
    structure: {
      preview, workflows: tpls.flatMap((t) => t.workflows.map((w) => ({ dept: t.key, ...w }))),
    } as unknown as Record<string, unknown>,
  });
  await admin.from("audit_log").insert({
    org_id: orgId, action: "org_structure_provisioned", table_name: "org_departments",
    meta: { actor_name: "بناء المنشأة", detail: `اعتماد وإنشاء هيكل: ${counters.departments} إدارة، ${counters.roles} مسمى وظيفي، ${counters.humanOffices + counters.aiOffices} مكتب` },
  });

  return {
    ok: true,
    summary: {
      departments: counters.departments, sections: counters.sections, roles: counters.roles,
      humanOffices: counters.humanOffices, aiOffices: counters.aiOffices,
      forms: counters.forms, workflows: counters.workflows,
      permissions: allPerms.size, kpis: allKpis.size,
      dashboards: counters.humanOffices + counters.aiOffices,
    },
  };
}

// ─── حالة الهيكل (هل تم الإنشاء؟) ────────────────────────────────────────────────

export async function getProvisionStatus(): Promise<{ ok: boolean; provisioned: boolean; isOwner: boolean; counts: { departments: number; offices: number } }> {
  const auth = await resolveAuth();
  if (!auth.ok) return { ok: false, provisioned: false, isOwner: false, counts: { departments: 0, offices: 0 } };
  const { ctx } = auth;
  const admin = createAdminClient()!;
  const [{ count: deptCount }, { count: memCount }, { count: agentCount }, { data: office }] = await Promise.all([
    admin.from("org_departments").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("active", true),
    admin.from("dept_members").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    admin.from("ai_agents").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    admin.from("org_office").select("setup_done").eq("org_id", ctx.orgId).maybeSingle(),
  ]);
  return {
    ok: true,
    provisioned: !!office?.setup_done && (deptCount ?? 0) > 0,
    isOwner: ctx.isOwner,
    counts: { departments: deptCount ?? 0, offices: (memCount ?? 0) + (agentCount ?? 0) },
  };
}
