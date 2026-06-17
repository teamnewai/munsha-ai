import { createClient } from "@/lib/supabase/server";
import type {
  OrgDepartment,
  DeptMember,
  Party,
  Property,
  Unit,
  Contract,
  Invoice,
  MaintenanceRequest,
  Lead,
  ServiceProvider,
} from "@/types/database";

// مُلكي — طبقة بيانات (قراءة فقط من المخطّط الحقيقي · RLS · لا كتابة)

/** يحلّ منشأة المستخدم الحالي؛ يُرجع null إن لم يُربط Supabase أو لم يسجّل الدخول. */
async function resolveOrg() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: m } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!m?.org_id) return null;
  return { supabase, orgId: m.org_id as string };
}

export interface ListResult<T> {
  isReal: boolean;
  rows: T[];
}

/* ============================ لوحة المالك ============================ */

export interface DepartmentCard {
  name: string;
  icon: string;
  emp: number;
  open: number;
  done: number;
  perf: number;
}
export interface PresenceRow {
  name: string;
  present: boolean;
  dept: string;
}
export interface DashboardData {
  isReal: boolean;
  orgName: string | null;
  unitsTotal: number;
  contractsActive: number;
  invoicesPending: number;
  departments: DepartmentCard[];
  presence: PresenceRow[];
}

export const DEMO_DASHBOARD: DashboardData = {
  isReal: false,
  orgName: null,
  unitsTotal: 42,
  contractsActive: 31,
  invoicesPending: 7,
  departments: [
    { name: "المالية", icon: "💰", emp: 14, open: 9, done: 41, perf: 92 },
    { name: "المبيعات", icon: "📈", emp: 22, open: 17, done: 63, perf: 78 },
    { name: "الصيانة", icon: "🔧", emp: 18, open: 12, done: 54, perf: 64 },
    { name: "العمليات", icon: "⚙️", emp: 16, open: 7, done: 38, perf: 85 },
    { name: "خدمة العملاء", icon: "🎧", emp: 11, open: 5, done: 49, perf: 71 },
  ],
  presence: [
    { name: "أحمد العتيبي", present: true, dept: "المالية" },
    { name: "سارة القحطاني", present: true, dept: "المبيعات" },
    { name: "محمد الزهراني", present: true, dept: "العمليات" },
    { name: "خالد الدوسري", present: false, dept: "الصيانة" },
    { name: "نورة الشمري", present: false, dept: "خدمة العملاء" },
  ],
};

export async function getDashboardData(): Promise<DashboardData> {
  const ctx = await resolveOrg();
  if (!ctx) return DEMO_DASHBOARD;
  const { supabase, orgId } = ctx;

  const [org, units, contracts, invoices, depts, members] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("contracts").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase.from("org_departments").select("*").eq("org_id", orgId).order("sort", { ascending: true }),
    supabase.from("dept_members").select("full_name, present, dept_key").eq("org_id", orgId).limit(12),
  ]);

  const departments: DepartmentCard[] = ((depts.data as OrgDepartment[]) ?? []).map((d) => ({
    name: d.name,
    icon: d.icon ?? "🏢",
    emp: d.staff_count ?? 0,
    open: d.open_tasks ?? 0,
    done: d.done_tasks ?? 0,
    perf: d.perf ?? 0,
  }));
  const presence: PresenceRow[] = ((members.data as DeptMember[]) ?? []).map((m) => ({
    name: m.full_name ?? "—",
    present: Boolean(m.present),
    dept: m.dept_key ?? "",
  }));

  return {
    isReal: true,
    orgName: (org.data as { name: string } | null)?.name ?? null,
    unitsTotal: units.count ?? 0,
    contractsActive: contracts.count ?? 0,
    invoicesPending: invoices.count ?? 0,
    departments: departments.length ? departments : DEMO_DASHBOARD.departments,
    presence: presence.length ? presence : DEMO_DASHBOARD.presence,
  };
}

/* ============================ وحدات القوائم ============================ */

const DEMO_PROPERTIES: Property[] = [
  { id: "1", org_id: "", ref_code: "P-001", name: "برج العليا", city: "الرياض", district: "العليا", national_address: "RRRD2929", created_at: "" },
  { id: "2", org_id: "", ref_code: "P-002", name: "مجمع النخيل السكني", city: "جدة", district: "النخيل", national_address: "JJDA1820", created_at: "" },
];
const DEMO_UNITS: Unit[] = [
  { id: "1", org_id: "", property_id: null, unit_no: "A-204", unit_type: "apartment", area: 120, occupancy: "occupied" },
  { id: "2", org_id: "", property_id: null, unit_no: "B-110", unit_type: "office", area: 85, occupancy: "vacant" },
  { id: "3", org_id: "", property_id: null, unit_no: "C-309", unit_type: "shop", area: 60, occupancy: "occupied" },
];
const DEMO_CONTRACTS: Contract[] = [
  { id: "1", org_id: "", unit_id: null, tenant_id: null, owner_id: null, annual_rent: 48000, period: "سنوي", start_date: "2026-01-01", end_date: "2026-12-31", status: "active" },
  { id: "2", org_id: "", unit_id: null, tenant_id: null, owner_id: null, annual_rent: 72000, period: "سنوي", start_date: "2025-06-01", end_date: "2026-05-31", status: "active" },
];
const DEMO_INVOICES: Invoice[] = [
  { id: "1", org_id: "", unit_id: null, party_id: null, amount: 12000, due_date: "2026-07-01", status: "pending" },
  { id: "2", org_id: "", unit_id: null, party_id: null, amount: 6000, due_date: "2026-06-15", status: "overdue" },
  { id: "3", org_id: "", unit_id: null, party_id: null, amount: 18000, due_date: "2026-05-30", status: "paid" },
];
const DEMO_TEAM: DeptMember[] = [
  { id: "1", org_id: "", dept_key: "finance", full_name: "أحمد العتيبي", job_title: "محاسب أول", present: true, status: "active", section: "المحاسبة", avatar_url: null },
  { id: "2", org_id: "", dept_key: "sales", full_name: "سارة القحطاني", job_title: "مدير مبيعات", present: true, status: "active", section: "المبيعات الميدانية", avatar_url: null },
  { id: "3", org_id: "", dept_key: "maintenance", full_name: "خالد الدوسري", job_title: "مشرف صيانة", present: false, status: "suspended", section: "الطارئة", avatar_url: null },
];

export async function getProperties(): Promise<ListResult<Property>> {
  const ctx = await resolveOrg();
  if (!ctx) return { isReal: false, rows: DEMO_PROPERTIES };
  const { data } = await ctx.supabase.from("properties").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false }).limit(100);
  return { isReal: true, rows: (data as Property[]) ?? [] };
}
export async function getUnits(): Promise<ListResult<Unit>> {
  const ctx = await resolveOrg();
  if (!ctx) return { isReal: false, rows: DEMO_UNITS };
  const { data } = await ctx.supabase.from("units").select("*").eq("org_id", ctx.orgId).limit(200);
  return { isReal: true, rows: (data as Unit[]) ?? [] };
}
export async function getContracts(): Promise<ListResult<Contract>> {
  const ctx = await resolveOrg();
  if (!ctx) return { isReal: false, rows: DEMO_CONTRACTS };
  const { data } = await ctx.supabase.from("contracts").select("*").eq("org_id", ctx.orgId).order("start_date", { ascending: false }).limit(200);
  return { isReal: true, rows: (data as Contract[]) ?? [] };
}
export async function getInvoices(): Promise<ListResult<Invoice>> {
  const ctx = await resolveOrg();
  if (!ctx) return { isReal: false, rows: DEMO_INVOICES };
  const { data } = await ctx.supabase.from("invoices").select("*").eq("org_id", ctx.orgId).order("due_date", { ascending: false }).limit(200);
  return { isReal: true, rows: (data as Invoice[]) ?? [] };
}
export async function getTeam(): Promise<ListResult<DeptMember>> {
  const ctx = await resolveOrg();
  if (!ctx) return { isReal: false, rows: DEMO_TEAM };
  const { data } = await ctx.supabase.from("dept_members").select("id, org_id, dept_key, full_name, job_title, present, status, section, avatar_url").eq("org_id", ctx.orgId).limit(200);
  return { isReal: true, rows: (data as DeptMember[]) ?? [] };
}

const DEMO_TENANTS: Party[] = [
  { id: "1", org_id: "", party_type: "tenant", full_name: "عبدالله الشهري", national_id: "1•••••234", phone: "05••••1234", created_at: "" },
  { id: "2", org_id: "", party_type: "tenant", full_name: "منيرة القرني", national_id: "1•••••567", phone: "05••••5678", created_at: "" },
];
const DEMO_OWNERS: Party[] = [
  { id: "1", org_id: "", party_type: "owner", full_name: "شركة العليا العقارية", national_id: "7•••••001", phone: "05••••9000", created_at: "" },
  { id: "2", org_id: "", party_type: "owner", full_name: "فهد المطيري", national_id: "1•••••890", phone: "05••••3344", created_at: "" },
];

export async function getParties(type: "owner" | "tenant"): Promise<ListResult<Party>> {
  const ctx = await resolveOrg();
  if (!ctx) return { isReal: false, rows: type === "owner" ? DEMO_OWNERS : DEMO_TENANTS };
  const { data } = await ctx.supabase
    .from("parties")
    .select("id, org_id, party_type, national_id, full_name, phone, created_at")
    .eq("org_id", ctx.orgId)
    .eq("party_type", type)
    .order("created_at", { ascending: false })
    .limit(500);
  return { isReal: true, rows: (data as Party[]) ?? [] };
}

const DEMO_MAINTENANCE: MaintenanceRequest[] = [
  { id: "1", org_id: "", unit_id: null, title: "عطل تكييف — برج العليا", description: "", status: "open", estimated_cost: 1850, approval_level: "manager", created_at: "" },
  { id: "2", org_id: "", unit_id: null, title: "تسريب مياه — وحدة A-204", description: "", status: "in_progress", estimated_cost: 420, approval_level: "auto", created_at: "" },
  { id: "3", org_id: "", unit_id: null, title: "صيانة مصعد", description: "", status: "open", estimated_cost: 6200, approval_level: "owner", created_at: "" },
];
const DEMO_LEADS: Lead[] = [
  { id: "1", kind: "إيجار", city: "الرياض", region: "الوسطى", unit_type: "apartment", budget_max: 60000, service_category: null, contact_name: "ع. الشهري", contact_phone: "05••••1234", status: "new", score: 82, created_at: "" },
  { id: "2", kind: "صيانة", city: "جدة", region: "الغربية", unit_type: null, budget_max: 3000, service_category: "تكييف", contact_name: "م. القرني", contact_phone: "05••••5678", status: "contacted", score: 64, created_at: "" },
];
const DEMO_PROVIDERS: ServiceProvider[] = [
  { id: "1", org_id: "", name: "شركة الإتقان للصيانة", phone: "0112345678", category: "صيانة عامة", composite_score: 4.6, created_at: "" },
  { id: "2", org_id: "", name: "مؤسسة البرودة للتكييف", phone: "0119876543", category: "تكييف", composite_score: 4.2, created_at: "" },
];

export async function getMaintenance(): Promise<ListResult<MaintenanceRequest>> {
  const ctx = await resolveOrg();
  if (!ctx) return { isReal: false, rows: DEMO_MAINTENANCE };
  const { data } = await ctx.supabase.from("maintenance_requests").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false }).limit(200);
  return { isReal: true, rows: (data as MaintenanceRequest[]) ?? [] };
}

// ملاحظة: leads بدون org_id — الرؤية عبر RLS الجغرافي. نقرأ ضمن جلسة المستخدم.
export async function getLeads(): Promise<ListResult<Lead>> {
  const ctx = await resolveOrg();
  if (!ctx) return { isReal: false, rows: DEMO_LEADS };
  const { data } = await ctx.supabase.from("leads").select("id, kind, city, region, unit_type, budget_max, service_category, contact_name, contact_phone, status, score, created_at").order("created_at", { ascending: false }).limit(200);
  return { isReal: true, rows: (data as Lead[]) ?? [] };
}

export async function getProviders(): Promise<ListResult<ServiceProvider>> {
  const ctx = await resolveOrg();
  if (!ctx) return { isReal: false, rows: DEMO_PROVIDERS };
  const { data } = await ctx.supabase.from("service_providers").select("id, org_id, name, phone, category, composite_score, created_at").eq("org_id", ctx.orgId).order("composite_score", { ascending: false }).limit(200);
  return { isReal: true, rows: (data as ServiceProvider[]) ?? [] };
}

/* ============================ المالية ============================ */
export interface AgingRow { bucket: string; count: number; sum: number; }
export interface FinanceData {
  isReal: boolean;
  collected: number;
  pendingSum: number;
  pendingCount: number;
  overdueSum: number;
  overdueCount: number;
  paidSum: number;
  aging: AgingRow[];
  recentPayments: { amount: number | null; method: string | null; paid_on: string | null }[];
}

const PENDING_STATUSES = ["pending", "unpaid", "due", "overdue"];
const sum = (rows: { amount: number | null }[]) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

export const DEMO_FINANCE: FinanceData = {
  isReal: false,
  collected: 1860000,
  pendingSum: 124000,
  pendingCount: 7,
  overdueSum: 38000,
  overdueCount: 3,
  paidSum: 1860000,
  aging: [
    { bucket: "current", count: 4, sum: 86000 },
    { bucket: "0_30", count: 2, sum: 24000 },
    { bucket: "31_60", count: 1, sum: 8000 },
    { bucket: "60_plus", count: 2, sum: 30000 },
  ],
  recentPayments: [
    { amount: 18000, method: "تحويل", paid_on: "2026-06-14" },
    { amount: 6000, method: "مدى", paid_on: "2026-06-12" },
    { amount: 42000, method: "تحويل", paid_on: "2026-06-09" },
  ],
};

/* ============================ اتحاد الملاك (HOA) ============================ */
export interface CommunityData {
  isReal: boolean;
  communities: { name: string; units: number }[];
  feesCollected: number;
  feesOutstanding: number;
  feesCount: number;
}

export const DEMO_COMMUNITY: CommunityData = {
  isReal: false,
  communities: [
    { name: "اتحاد ملاك برج العليا", units: 24 },
    { name: "اتحاد مجمع النخيل", units: 16 },
  ],
  feesCollected: 84000,
  feesOutstanding: 21000,
  feesCount: 40,
};

export async function getCommunityData(): Promise<CommunityData> {
  const ctx = await resolveOrg();
  if (!ctx) return DEMO_COMMUNITY;
  const { supabase, orgId } = ctx;

  const [comm, fees] = await Promise.all([
    supabase.from("communities").select("id, name").eq("org_id", orgId).limit(200),
    supabase.from("hoa_fees").select("amount, status, community_id").eq("org_id", orgId).limit(2000),
  ]);

  const feeRows = (fees.data as { amount: number | null; status: string | null; community_id: string | null }[]) ?? [];
  const collected = sum(feeRows.filter((f) => (f.status ?? "").toLowerCase() === "paid"));
  const outstanding = sum(feeRows.filter((f) => (f.status ?? "").toLowerCase() !== "paid"));

  const communities = ((comm.data as { id: string; name: string }[]) ?? []).map((c) => ({
    name: c.name,
    units: feeRows.filter((f) => f.community_id === c.id).length,
  }));

  return {
    isReal: true,
    communities,
    feesCollected: collected,
    feesOutstanding: outstanding,
    feesCount: feeRows.length,
  };
}

/* ============================ التحليلات (المرحلة 12) ============================ */
export interface AnalyticsData {
  isReal: boolean;
  unitsTotal: number;
  unitsOccupied: number;
  occupancyRate: number;
  contractsActive: number;
  contractsTotal: number;
  collected: number;
  pendingSum: number;
  pendingCount: number;
  overdueCount: number;
  maintOpen: number;
  maintDone: number;
  teamSize: number;
  feedbackOpen: number;
  errorsOpen: number;
}

export const DEMO_ANALYTICS: AnalyticsData = {
  isReal: false,
  unitsTotal: 42, unitsOccupied: 31, occupancyRate: 74,
  contractsActive: 31, contractsTotal: 38,
  collected: 1860000, pendingSum: 124000, pendingCount: 7, overdueCount: 3,
  maintOpen: 12, maintDone: 54, teamSize: 18, feedbackOpen: 2, errorsOpen: 0,
};

export async function getAnalytics(): Promise<AnalyticsData> {
  const ctx = await resolveOrg();
  if (!ctx) return DEMO_ANALYTICS;
  const { supabase, orgId } = ctx;

  const [units, contractsActive, contractsTotal, invoices, payments, maint, team, feedback, errors] =
    await Promise.all([
      supabase.from("units").select("occupancy").eq("org_id", orgId).limit(5000),
      supabase.from("contracts").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
      supabase.from("contracts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("invoices").select("amount, status").eq("org_id", orgId).limit(5000),
      supabase.from("payments").select("amount").eq("org_id", orgId).limit(5000),
      supabase.from("maintenance_requests").select("status").eq("org_id", orgId).limit(5000),
      supabase.from("dept_members").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("page_feedback").select("id", { count: "exact", head: true }).eq("org_id", orgId).neq("status", "resolved"),
      supabase.from("client_errors").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open"),
    ]);

  const unitRows = (units.data as { occupancy: string | null }[]) ?? [];
  const unitsTotal = unitRows.length;
  const unitsOccupied = unitRows.filter((u) => (u.occupancy ?? "").toLowerCase() === "occupied").length;
  const invRows = (invoices.data as { amount: number | null; status: string | null }[]) ?? [];
  const payRows = (payments.data as { amount: number | null }[]) ?? [];
  const pending = invRows.filter((i) => PENDING_STATUSES.includes((i.status ?? "").toLowerCase()));
  const overdue = invRows.filter((i) => (i.status ?? "").toLowerCase() === "overdue");
  const maintRows = (maint.data as { status: string | null }[]) ?? [];

  return {
    isReal: true,
    unitsTotal,
    unitsOccupied,
    occupancyRate: unitsTotal ? Math.round((unitsOccupied / unitsTotal) * 100) : 0,
    contractsActive: contractsActive.count ?? 0,
    contractsTotal: contractsTotal.count ?? 0,
    collected: sum(payRows),
    pendingSum: sum(pending),
    pendingCount: pending.length,
    overdueCount: overdue.length,
    maintOpen: maintRows.filter((m) => ["open", "in_progress"].includes((m.status ?? "").toLowerCase())).length,
    maintDone: maintRows.filter((m) => ["done", "closed", "resolved"].includes((m.status ?? "").toLowerCase())).length,
    teamSize: team.count ?? 0,
    feedbackOpen: feedback.count ?? 0,
    errorsOpen: errors.count ?? 0,
  };
}

export async function getFinance(): Promise<FinanceData> {
  const ctx = await resolveOrg();
  if (!ctx) return DEMO_FINANCE;
  const { supabase, orgId } = ctx;

  const [pay, inv, arr] = await Promise.all([
    supabase.from("payments").select("amount, method, paid_on").eq("org_id", orgId).order("paid_on", { ascending: false }).limit(500),
    supabase.from("invoices").select("amount, status, due_date").eq("org_id", orgId).limit(2000),
    supabase.from("v_arrears").select("amount, aging_bucket").eq("org_id", orgId).limit(2000),
  ]);

  const payments = (pay.data as { amount: number | null; method: string | null; paid_on: string | null }[]) ?? [];
  const invoices = (inv.data as { amount: number | null; status: string | null }[]) ?? [];
  const arrears = (arr.data as { amount: number | null; aging_bucket: string | null }[]) ?? [];

  const pending = invoices.filter((i) => PENDING_STATUSES.includes((i.status ?? "").toLowerCase()));
  const overdue = invoices.filter((i) => (i.status ?? "").toLowerCase() === "overdue");
  const paid = invoices.filter((i) => (i.status ?? "").toLowerCase() === "paid");

  const buckets = ["current", "0_30", "31_60", "60_plus"];
  const aging: AgingRow[] = buckets.map((b) => {
    const rows = arrears.filter((a) => a.aging_bucket === b);
    return { bucket: b, count: rows.length, sum: sum(rows) };
  });

  return {
    isReal: true,
    collected: sum(payments),
    pendingSum: sum(pending),
    pendingCount: pending.length,
    overdueSum: sum(overdue),
    overdueCount: overdue.length,
    paidSum: sum(paid),
    aging,
    recentPayments: payments.slice(0, 8),
  };
}
