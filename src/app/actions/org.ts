"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgIdOrFallback } from "@/lib/org-context";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrgMember = {
  id: string;
  name: string;
  title: string;
  deptKey: string;
  deptName: string;
  deptColor: string;
  roleInDept: "head" | "member";
  suspended: boolean;
  present: boolean;
};

export type DeptDetail = {
  key: string;
  name: string;
  color: string;
  staffCount: number;
  openTasks: number;
  doneTasks: number;
  perf: number;
  members: OrgMember[];
};

export type NotifItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

export type Meeting = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  importance: string;
  status: string;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  source: string | null;
  dept_key: string | null;
  status: string | null;
  raw_text: string | null;
  created_at: string;
};

export type MarketService = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  active: boolean;
};

// ─── getOrgMembers ────────────────────────────────────────────────────────────

export async function getOrgMembers(): Promise<{
  ok: boolean;
  members: OrgMember[];
  depts: { key: string; name: string; color: string }[];
}> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, members: [], depts: [] };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const [membersRes, deptsRes] = await Promise.all([
    supabase
      .from("dept_members")
      .select("id, org_id, dept_key, full_name, job_title, role_in_dept, suspended, present, status")
      .eq("org_id", ORG_ID),
    supabase
      .from("org_departments")
      .select("dept_key, name, color, staff_count, open_tasks, done_tasks, perf, active, sort")
      .eq("org_id", ORG_ID)
      .order("sort", { ascending: true }),
  ]);

  if (membersRes.error || deptsRes.error) {
    console.error("[getOrgMembers]", membersRes.error, deptsRes.error);
    return { ok: false, members: [], depts: [] };
  }

  const deptMap = new Map<string, { name: string; color: string }>(
    (deptsRes.data ?? []).map((d) => [d.dept_key, { name: d.name, color: d.color }])
  );

  const members: OrgMember[] = (membersRes.data ?? []).map((m) => ({
    id: m.id,
    name: m.full_name,
    title: m.job_title ?? "",
    deptKey: m.dept_key,
    deptName: deptMap.get(m.dept_key)?.name ?? m.dept_key,
    deptColor: deptMap.get(m.dept_key)?.color ?? "#C9A24B",
    roleInDept: m.role_in_dept as "head" | "member",
    suspended: m.suspended ?? false,
    present: m.present ?? false,
  }));

  const depts = (deptsRes.data ?? []).map((d) => ({
    key: d.dept_key,
    name: d.name,
    color: d.color,
  }));

  return { ok: true, members, depts };
}

// ─── getDeptByKey ─────────────────────────────────────────────────────────────

export async function getDeptByKey(key: string): Promise<{ ok: boolean; dept?: DeptDetail }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const [deptRes, membersRes] = await Promise.all([
    supabase
      .from("org_departments")
      .select("dept_key, name, color, staff_count, open_tasks, done_tasks, perf")
      .eq("org_id", ORG_ID)
      .eq("dept_key", key)
      .single(),
    supabase
      .from("dept_members")
      .select("id, dept_key, full_name, job_title, role_in_dept, suspended, present")
      .eq("org_id", ORG_ID)
      .eq("dept_key", key),
  ]);

  if (deptRes.error || !deptRes.data) {
    console.error("[getDeptByKey]", deptRes.error);
    return { ok: false };
  }

  const d = deptRes.data;
  const members: OrgMember[] = (membersRes.data ?? []).map((m) => ({
    id: m.id,
    name: m.full_name,
    title: m.job_title ?? "",
    deptKey: m.dept_key,
    deptName: d.name,
    deptColor: d.color,
    roleInDept: m.role_in_dept as "head" | "member",
    suspended: m.suspended ?? false,
    present: m.present ?? false,
  }));

  return {
    ok: true,
    dept: {
      key: d.dept_key,
      name: d.name,
      color: d.color,
      staffCount: d.staff_count ?? 0,
      openTasks: d.open_tasks ?? 0,
      doneTasks: d.done_tasks ?? 0,
      perf: d.perf ?? 0,
      members,
    },
  };
}

// ─── getNotificationsData ─────────────────────────────────────────────────────

export async function getNotificationsData(): Promise<{ ok: boolean; items: NotifItem[] }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, items: [] };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, is_read, created_at")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[getNotificationsData]", error);
    return { ok: false, items: [] };
  }

  const items: NotifItem[] = (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body ?? null,
    is_read: n.is_read ?? false,
    created_at: n.created_at,
  }));

  return { ok: true, items };
}

// ─── markNotificationRead ─────────────────────────────────────────────────────

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  if (error) {
    console.error("[markNotificationRead]", error);
    return { ok: false };
  }

  return { ok: true };
}

// ─── getMeetings ─────────────────────────────────────────────────────────────

export async function getMeetings(): Promise<{ ok: boolean; meetings: Meeting[] }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, meetings: [] };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, title, description, location, starts_at, ends_at, importance, status")
    .eq("org_id", ORG_ID)
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("[getMeetings]", error);
    return { ok: false, meetings: [] };
  }

  const meetings: Meeting[] = (data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description ?? null,
    location: m.location ?? null,
    starts_at: m.starts_at,
    ends_at: m.ends_at ?? null,
    importance: m.importance ?? "normal",
    status: m.status ?? "scheduled",
  }));

  return { ok: true, meetings };
}

// ─── createMeeting ────────────────────────────────────────────────────────────

export async function createMeeting(input: {
  title: string;
  description?: string;
  location?: string;
  starts_at: string;
  ends_at?: string;
  importance: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "no supabase client" };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { error } = await supabase.from("appointments").insert({
    org_id: ORG_ID,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    importance: input.importance,
    status: "scheduled",
  });

  if (error) {
    console.error("[createMeeting]", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── getKnowledgeDocs ─────────────────────────────────────────────────────────

export async function getKnowledgeDocs(): Promise<{ ok: boolean; docs: KnowledgeDoc[] }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, docs: [] };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, title, source, dept_key, status, raw_text, created_at")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getKnowledgeDocs]", error);
    return { ok: false, docs: [] };
  }

  const docs: KnowledgeDoc[] = (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    source: d.source ?? null,
    dept_key: d.dept_key ?? null,
    status: d.status ?? null,
    raw_text: d.raw_text ?? null,
    created_at: d.created_at,
  }));

  return { ok: true, docs };
}

// ─── addKnowledgeDoc ─────────────────────────────────────────────────────────

export async function addKnowledgeDoc(input: {
  title: string;
  source: string;
  dept_key?: string;
  raw_text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "no supabase client" };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { error } = await supabase.from("knowledge_documents").insert({
    org_id: ORG_ID,
    title: input.title,
    source: input.source,
    dept_key: input.dept_key ?? null,
    raw_text: input.raw_text,
    status: "active",
  });

  if (error) {
    console.error("[addKnowledgeDoc]", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── getMarketServices ────────────────────────────────────────────────────────

export async function getMarketServices(): Promise<{ ok: boolean; services: MarketService[] }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, services: [] };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { data, error } = await supabase
    .from("market_services")
    .select("id, category, title, description, price, currency, active")
    .eq("org_id", ORG_ID)
    .eq("active", true);

  if (error) {
    console.error("[getMarketServices]", error);
    return { ok: false, services: [] };
  }

  const services: MarketService[] = (data ?? []).map((s) => ({
    id: s.id,
    category: s.category,
    title: s.title,
    description: s.description ?? null,
    price: s.price ?? 0,
    currency: s.currency ?? "SAR",
    active: s.active ?? true,
  }));

  return { ok: true, services };
}

// ─── publishMarketService ─────────────────────────────────────────────────────

export async function publishMarketService(input: {
  title: string;
  category: string;
  description?: string;
  price?: number;
  currency?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { error } = await supabase.from("market_services").insert({
    org_id: ORG_ID,
    category: input.category,
    title: input.title,
    description: input.description ?? null,
    price: input.price ?? 0,
    currency: input.currency ?? "SAR",
    active: false,
  });

  if (error) {
    console.error("[publishMarketService]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ─── requestMarketService — يربط طلب الخدمة بسير عمل حقيقي يُوجّه لإدارة/مكتب ─────

const CATEGORY_DEPT_HINT: Record<string, string[]> = {
  صيانة: ["maintenance", "ops"],
  استشارات: ["legal", "management"],
  تدريب: ["hr"],
  تسويق: ["marketing", "sales"],
  مبيعات: ["sales"],
  مالية: ["finance"],
  تقنية: ["it", "tech"],
};

export async function requestMarketService(serviceId: string): Promise<{ ok: boolean; error?: string; routedTo?: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { data: svc } = await supabase
    .from("market_services")
    .select("id,title,category,price,currency")
    .eq("id", serviceId)
    .eq("org_id", ORG_ID)
    .maybeSingle();
  if (!svc) return { ok: false, error: "الخدمة غير موجودة" };

  // حدّد الإدارة المستقبِلة للطلب من بين إدارات المنشأة الفعلية
  const { data: depts } = await supabase
    .from("org_departments")
    .select("dept_key,name")
    .eq("org_id", ORG_ID)
    .eq("active", true)
    .order("sort");
  const deptList = depts ?? [];
  const hints = CATEGORY_DEPT_HINT[svc.category] ?? ["cs", "ops", "sales"];
  const target =
    deptList.find((d) => hints.includes(d.dept_key)) ??
    deptList.find((d) => d.dept_key === "cs") ??
    deptList[0] ??
    null;

  // 1) سجل الطلب في market_orders
  const { error: orderErr } = await supabase.from("market_orders").insert({
    org_id: ORG_ID, service_id: svc.id, amount: svc.price ?? 0,
    currency: svc.currency ?? "SAR", status: "new",
  });
  if (orderErr) return { ok: false, error: orderErr.message };

  // 2) وجّه مهمة عمل إلى الإدارة/المكتب المختص
  await supabase.from("org_tasks").insert({
    org_id: ORG_ID,
    title: `طلب خدمة: ${svc.title}`,
    description: target ? `طلب وارد من سوق الخدمات — موجّه إلى ${target.name}.` : "طلب وارد من سوق الخدمات.",
    priority: "متوسطة", status: "جديدة", done: false,
  });

  // 3) أنشئ إشعاراً
  await supabase.from("notifications").insert({
    org_id: ORG_ID, kind: "market_order",
    title: "طلب خدمة جديد", body: `تم استلام طلب على «${svc.title}»${target ? ` وتوجيهه إلى ${target.name}` : ""}.`,
    is_read: false,
  });

  return { ok: true, routedTo: target?.name };
}
