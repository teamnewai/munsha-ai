import { createAdminClient } from "./supabase/admin";
import { getCurrentOrgId } from "./org-context";
import { EMPTY_OS, DEMO_LABEL, deriveOsData, PALETTE, type Dept, type OsData, type PresentEmp, type AbsentEmp } from "./os-data";

type DeptRow = {
  dept_key: string | null;
  name: string | null;
  color: string | null;
  staff_count: number | null;
  open_tasks: number | null;
  done_tasks: number | null;
  perf: number | null;
};

type MemberRow = { full_name: string; job_title: string | null; dept_key: string; present: boolean };
type NotifRow = { title: string; body: string | null; kind: string; created_at: string };
type InvoiceRow = { total_amount: number | null; type: string | null };

/**
 * يقرأ بيانات لوحة القيادة حيّاً من Supabase (الهيكل التنظيمي الحقيقي)،
 * ويتراجع إلى أرقام العرض المتسقة لأي قيمة فارغة — دون أي كتابة في القاعدة.
 */
export async function getOsData(): Promise<OsData> {
  const sb = createAdminClient();
  if (!sb) return EMPTY_OS;

  // عزل صارم: بيانات منشأة المستخدم الحالي فقط. بلا منشأة → حالة «تجريبي» فارغة.
  const orgId = await getCurrentOrgId();
  if (!orgId) return EMPTY_OS;

  try {
    const [orgRes, deptRes, notifRes, memRes, invoiceRes, notifListRes] = await Promise.all([
      sb.from("organizations").select("name").eq("id", orgId).maybeSingle(),
      sb.from("org_departments").select("dept_key,name,color,staff_count,open_tasks,done_tasks,perf").eq("org_id", orgId).eq("active", true).order("sort"),
      sb.from("notifications").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_read", false),
      sb.from("dept_members").select("full_name,job_title,dept_key,present").eq("org_id", orgId).eq("status", "active"),
      sb.from("invoices").select("total_amount,type").eq("org_id", orgId),
      sb.from("notifications").select("title,body,kind,created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(6),
    ]);

    const orgName = (orgRes.data?.name as string) || DEMO_LABEL;
    const rows = (deptRes.data as DeptRow[] | null) ?? [];
    if (rows.length === 0) return { ...EMPTY_OS, source: "live", orgName };

    // أسماء وألوان الإدارات الحقيقية + مقاييس فعلية (أصفار عند الغياب، بلا تعبئة وهمية)
    const departments: Dept[] = rows.map((d, i) => ({
      key: d.dept_key || `dept-${i}`,
      name: d.name || DEMO_LABEL,
      color: d.color && d.color.toUpperCase() !== "#3B82F6" ? d.color : PALETTE[i % PALETTE.length],
      employees: d.staff_count ?? 0,
      open: d.open_tasks ?? 0,
      done: d.done_tasks ?? 0,
      perf: d.perf ?? 0,
    }));

    // الموظفون الفعليون من dept_members — في الوضع الحي نعرض الواقع (ولو فارغاً) لا أسماء وهمية
    const members = (memRes.data as MemberRow[] | null) ?? [];
    const deptName = (k: string) => rows.find((r) => r.dept_key === k)?.name || k;
    const present = members.filter((m) => m.present);
    const employees: { total: number; present: number } = { total: members.length, present: present.length };
    const presentNow: PresentEmp[] = present.slice(0, 6).map((m) => ({
      name: m.full_name, role: m.job_title || "موظف", dept: deptName(m.dept_key), time: "",
    }));
    const absent: AbsentEmp[] = members.filter((m) => !m.present).slice(0, 4).map((m) => ({
      name: m.full_name, role: m.job_title || "موظف", dept: deptName(m.dept_key),
    }));

    // حساب الإيرادات والمصروفات من الفواتير الحقيقية
    const invoices = (invoiceRes.data as InvoiceRow[] | null) ?? [];
    const revenue = invoices.filter((i) => i.type === "income" || i.type === "revenue").reduce((s, i) => s + (i.total_amount ?? 0), 0);
    const expenses = invoices.filter((i) => i.type === "expense" || i.type === "payment").reduce((s, i) => s + (i.total_amount ?? 0), 0);

    // التواصل الأخير من الإشعارات الحقيقية
    const notifList = (notifListRes.data as NotifRow[] | null) ?? [];
    const recentComms = notifList.length > 0 ? notifList.map((n) => ({
      kind: (n.kind === "meeting" ? "meeting" : n.kind === "payment" ? "message" : "message") as "meeting" | "call" | "message",
      from: "النظام",
      to: "الجميع",
      msg: n.title + (n.body ? ` — ${n.body.slice(0, 40)}` : ""),
      time: new Date(n.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
    })) : undefined;

    return deriveOsData(departments, {
      source: "live",
      orgName,
      notifications: notifRes.count || undefined,
      employees,
      presentNow,
      absent,
      finance: revenue > 0 || expenses > 0 ? { revenue, expenses } : undefined,
      recentComms,
    });
  } catch {
    return EMPTY_OS;
  }
}
