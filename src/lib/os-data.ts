// المصدر الموحّد لأرقام مُلكي OS — بيانات حقيقية فقط من Supabase.
// لا توجد أي بيانات وهمية هنا؛ عند غياب البيانات تُعرض أصفار أو وسم «تجريبي».

export type Dept = {
  key: string;
  name: string;
  color: string;
  employees: number;
  open: number; // المهام المفتوحة
  done: number; // المهام المكتملة
  perf: number; // الأداء %
};

export type PresentEmp = { name: string; role: string; dept: string; time: string };
export type AbsentEmp = { name: string; role: string; dept: string };

export type OsData = {
  source: "live" | "demo";
  orgName: string;
  owner: string;
  departments: Dept[];
  employees: { total: number; present: number; absent: number };
  tasks: { open: number; done: number; completedPct: number; overdue: number };
  finance: { revenue: number; expenses: number; profit: number };
  notifications: { unread: number };
  inbox: { newEmails: number; callsToday: number };
  presentNow: PresentEmp[];
  absent: AbsentEmp[];
  recentComms?: { kind: "meeting" | "call" | "message"; from: string; to: string; msg: string; time: string }[];
};

// وسم العرض حين لا تتوفّر منشأة/بيانات بعد
export const DEMO_LABEL = "تجريبي";

export const PALETTE = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#6366f1"];

// يشتق الإجماليات من بيانات الإدارات الحقيقية فقط — بلا أي تعبئة وهمية
export function deriveOsData(
  departments: Dept[],
  opts: {
    source: "live" | "demo"; orgName: string; owner?: string; notifications?: number;
    inbox?: { newEmails: number; callsToday: number };
    employees?: { total: number; present: number };
    presentNow?: PresentEmp[]; absent?: AbsentEmp[];
    finance?: { revenue: number; expenses: number };
    recentComms?: OsData["recentComms"];
  },
): OsData {
  const total = opts.employees?.total ?? departments.reduce((s, d) => s + d.employees, 0);
  const present = opts.employees?.present ?? 0;
  const open = departments.reduce((s, d) => s + d.open, 0);
  const done = departments.reduce((s, d) => s + d.done, 0);
  const revenue = opts.finance?.revenue ?? 0;
  const expenses = opts.finance?.expenses ?? 0;
  return {
    source: opts.source,
    orgName: opts.orgName,
    owner: opts.owner ?? DEMO_LABEL,
    departments,
    employees: { total, present, absent: Math.max(total - present, 0) },
    tasks: {
      open,
      done,
      completedPct: done + open > 0 ? Math.round((done / (done + open)) * 100) : 0,
      overdue: 0,
    },
    finance: { revenue, expenses, profit: revenue - expenses },
    notifications: { unread: opts.notifications ?? 0 },
    inbox: opts.inbox ?? { newEmails: 0, callsToday: 0 },
    presentNow: opts.presentNow ?? [],
    absent: opts.absent ?? [],
    recentComms: opts.recentComms,
  };
}

// حالة فارغة موسومة «تجريبي» — تُستخدم قبل توفّر منشأة فعلية (بلا أي أرقام وهمية)
export const EMPTY_OS: OsData = deriveOsData([], { source: "demo", orgName: DEMO_LABEL });

export const fmt = (n: number) => n.toLocaleString("en-US");
