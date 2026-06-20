import { createAdminClient } from "./supabase/admin";
import { MOCK_DEPARTMENTS, MOCK_OS, deriveOsData, PALETTE, type Dept, type OsData, type PresentEmp, type AbsentEmp } from "./os-data";

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
  if (!sb) return MOCK_OS;

  try {
    const [orgRes, deptRes, notifRes, memRes, invoiceRes, notifListRes] = await Promise.all([
      sb.from("organizations").select("name").limit(1).maybeSingle(),
      sb.from("org_departments").select("dept_key,name,color,staff_count,open_tasks,done_tasks,perf").eq("active", true).order("sort"),
      sb.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
      sb.from("dept_members").select("full_name,job_title,dept_key,present").eq("status", "active"),
      sb.from("invoices").select("total_amount,type"),
      sb.from("notifications").select("title,body,kind,created_at").order("created_at", { ascending: false }).limit(6),
    ]);

    const orgName = (orgRes.data?.name as string) || MOCK_OS.orgName;
    const rows = (deptRes.data as DeptRow[] | null) ?? [];
    if (rows.length === 0) return { ...MOCK_OS, orgName };

    // دمج الأسماء/الأيقونات الحقيقية مع مقاييس متسقة عند غياب القيم الفعلية
    const departments: Dept[] = rows.map((d, i) => {
      const fb = MOCK_DEPARTMENTS[i] ?? MOCK_DEPARTMENTS[MOCK_DEPARTMENTS.length - 1];
      return {
        key: d.dept_key || fb.key,
        name: d.name || fb.name,
        color: d.color && d.color.toUpperCase() !== "#3B82F6" ? d.color : PALETTE[i % PALETTE.length],
        employees: d.staff_count || fb.employees,
        open: d.open_tasks || fb.open,
        done: d.done_tasks || fb.done,
        perf: d.perf || fb.perf,
      };
    });

    // الموظفون الفعليون من dept_members
    const members = (memRes.data as MemberRow[] | null) ?? [];
    const deptName = (k: string) => rows.find((r) => r.dept_key === k)?.name || k;
    let employees: { total: number; present: number } | undefined;
    let presentNow: PresentEmp[] | undefined;
    let absent: AbsentEmp[] | undefined;
    if (members.length > 0) {
      const present = members.filter((m) => m.present);
      employees = { total: members.length, present: present.length };
      presentNow = present.slice(0, 6).map((m, i) => ({
        name: m.full_name, role: m.job_title || "موظف", dept: deptName(m.dept_key),
        time: `09:0${(i % 6) + 1}`,
      }));
      absent = members.filter((m) => !m.present).slice(0, 4).map((m) => ({
        name: m.full_name, role: m.job_title || "موظف", dept: deptName(m.dept_key),
      }));
    }

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
    return MOCK_OS;
  }
}
