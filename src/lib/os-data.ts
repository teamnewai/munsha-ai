// المصدر الموحّد لأرقام مُلكي OS.
// القاعدة: بيانات المنشأة الحقيقية لها الأولوية دائماً. وعند غيابها تُعرض
// «بيانات تجريبية» موسومة بوضوح (source: "demo") ليجرّب المستخدم الخدمة فوراً.

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

// وسم العرض حين تكون البيانات تجريبية (لا تخصّ منشأة فعلية)
export const DEMO_LABEL = "تجريبي";

export const PALETTE = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#6366f1"];

// ── بيانات تجريبية للعرض فقط (تظهر موسومة «تجريبي» عند غياب منشأة حقيقية) ──
const DEMO_DEPARTMENTS: Dept[] = [
  { key: "finance", name: "المالية", color: PALETTE[0], employees: 18, open: 18, done: 142, perf: 92 },
  { key: "hr", name: "الموارد البشرية", color: PALETTE[1], employees: 16, open: 22, done: 108, perf: 88 },
  { key: "sales", name: "المبيعات", color: PALETTE[2], employees: 28, open: 31, done: 206, perf: 95 },
  { key: "ops", name: "التشغيل", color: PALETTE[3], employees: 32, open: 27, done: 189, perf: 90 },
  { key: "marketing", name: "التسويق", color: PALETTE[4], employees: 14, open: 14, done: 74, perf: 85 },
  { key: "legal", name: "الشؤون القانونية", color: PALETTE[5], employees: 10, open: 9, done: 58, perf: 87 },
  { key: "realestate", name: "العقارات", color: PALETTE[6], employees: 20, open: 16, done: 120, perf: 89 },
  { key: "it", name: "تقنية المعلومات", color: PALETTE[7], employees: 18, open: 14, done: 96, perf: 91 },
];

const DEMO_PRESENT: PresentEmp[] = [
  { name: "موظف تجريبي ١", role: "محاسب أول", dept: "المالية", time: "" },
  { name: "موظف تجريبي ٢", role: "أخصائي رواتب", dept: "الموارد البشرية", time: "" },
  { name: "موظف تجريبي ٣", role: "مندوب مبيعات", dept: "المبيعات", time: "" },
  { name: "موظف تجريبي ٤", role: "مدير العمليات", dept: "التشغيل", time: "" },
];
const DEMO_ABSENT: AbsentEmp[] = [
  { name: "موظف تجريبي ٥", role: "مطوّر برامج", dept: "تقنية المعلومات" },
];

// يشتق الإجماليات من بيانات الإدارات
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
  const present = opts.employees?.present ?? (opts.source === "demo" ? Math.round(total * 0.82) : 0);
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
      overdue: opts.source === "demo" ? Math.round(open * 0.15) : 0,
    },
    finance: { revenue, expenses, profit: revenue - expenses },
    notifications: { unread: opts.notifications ?? 0 },
    inbox: opts.inbox ?? { newEmails: 0, callsToday: 0 },
    presentNow: opts.presentNow ?? [],
    absent: opts.absent ?? [],
    recentComms: opts.recentComms,
  };
}

// عرض تجريبي جاهز (موسوم «تجريبي») — يظهر حين لا توجد منشأة/بيانات فعلية
export const DEMO_OS: OsData = deriveOsData(DEMO_DEPARTMENTS, {
  source: "demo",
  orgName: DEMO_LABEL,
  finance: { revenue: 2458000, expenses: 1125000 },
  presentNow: DEMO_PRESENT,
  absent: DEMO_ABSENT,
  notifications: 3,
  inbox: { newEmails: 5, callsToday: 12 },
  recentComms: [
    { kind: "message", from: "تجريبي", to: "الجميع", msg: "هذه رسالة تجريبية لعرض الخدمة", time: "" },
    { kind: "meeting", from: "تجريبي", to: "الفريق", msg: "اجتماع تجريبي", time: "" },
  ],
});

export const fmt = (n: number) => n.toLocaleString("en-US");
