import { createClient } from "@/lib/supabase/server";
import type { OrgDepartment, DeptMember } from "@/types/database";

// مُلكي — طبقة بيانات لوحة المالك (قراءة فقط من المخطّط الحقيقي)
// مرجع الجداول: organizations · org_departments · dept_members · units · contracts · invoices
// آمنة: تقرأ ضمن جلسة المستخدم (RLS)؛ لا تكتب شيئاً.

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

/** بيانات تجريبية للمعاينة قبل تسجيل الدخول بحساب حقيقي */
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

/**
 * يقرأ بيانات لوحة المالك من قاعدة البيانات الحقيقية لمنشأة المستخدم الحالي.
 * يُرجع DEMO_DASHBOARD إذا لم يُربط Supabase أو لم يسجّل المستخدم الدخول.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_DASHBOARD;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEMO_DASHBOARD;

  // منشأة المستخدم
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.org_id) return DEMO_DASHBOARD;

  const orgId = membership.org_id as string;

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
