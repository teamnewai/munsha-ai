import { createAdminClient } from "./supabase/admin";
import { MOCK_DEPARTMENTS, MOCK_OS, deriveOsData, PALETTE, type Dept, type OsData } from "./os-data";

type DeptRow = {
  dept_key: string | null;
  name: string | null;
  color: string | null;
  staff_count: number | null;
  open_tasks: number | null;
  done_tasks: number | null;
  perf: number | null;
};

/**
 * يقرأ بيانات لوحة القيادة حيّاً من Supabase (الهيكل التنظيمي الحقيقي)،
 * ويتراجع إلى أرقام العرض المتسقة لأي قيمة فارغة — دون أي كتابة في القاعدة.
 */
export async function getOsData(): Promise<OsData> {
  const sb = createAdminClient();
  if (!sb) return MOCK_OS;

  try {
    const [orgRes, deptRes, notifRes] = await Promise.all([
      sb.from("organizations").select("name").limit(1).maybeSingle(),
      sb.from("org_departments").select("dept_key,name,color,staff_count,open_tasks,done_tasks,perf").eq("active", true).order("sort"),
      sb.from("notifications").select("id", { count: "exact", head: true }),
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

    return deriveOsData(departments, {
      source: "live",
      orgName,
      notifications: notifRes.count || undefined,
    });
  } catch {
    return MOCK_OS;
  }
}
