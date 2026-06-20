// المصدر الموحّد لأرقام مُلكي OS — أرقام متسقة ومترابطة، مع دعم القراءة الحيّة من Supabase.

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

const DEFAULT_PRESENT: PresentEmp[] = [
  { name: "سارة القحطاني", role: "محاسبة أول", dept: "المالية", time: "09:10" },
  { name: "محمد الشهري", role: "أخصائي رواتب", dept: "الموارد البشرية", time: "09:05" },
  { name: "ناصر المطيري", role: "مندوب مبيعات", dept: "المبيعات", time: "09:12" },
  { name: "عبدالله السبيعي", role: "مدير العمليات", dept: "التشغيل", time: "09:08" },
  { name: "ريم العبيدي", role: "أخصائية تسويق", dept: "التسويق", time: "09:15" },
];
const DEFAULT_ABSENT: AbsentEmp[] = [
  { name: "خالد الحربي", role: "مطور برامج", dept: "تقنية المعلومات" },
  { name: "علي الزهراني", role: "محلل مالي", dept: "المالية" },
];

export const COMPANY = { owner: "أحمد بن محمد", title: "الرئيس التنفيذي" };

export const PALETTE = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#6366f1"];

// إدارات العرض الافتراضية — مجموع الموظفين = 156
export const MOCK_DEPARTMENTS: Dept[] = [
  { key: "finance", name: "المالية", color: PALETTE[0], employees: 18, open: 18, done: 142, perf: 92 },
  { key: "hr", name: "الموارد البشرية", color: PALETTE[1], employees: 16, open: 22, done: 108, perf: 88 },
  { key: "sales", name: "المبيعات", color: PALETTE[2], employees: 28, open: 31, done: 206, perf: 95 },
  { key: "ops", name: "التشغيل", color: PALETTE[3], employees: 32, open: 27, done: 189, perf: 90 },
  { key: "marketing", name: "التسويق", color: PALETTE[4], employees: 14, open: 14, done: 74, perf: 85 },
  { key: "legal", name: "الشؤون القانونية", color: PALETTE[5], employees: 10, open: 9, done: 58, perf: 87 },
  { key: "realestate", name: "العقارات", color: PALETTE[6], employees: 20, open: 16, done: 120, perf: 89 },
  { key: "it", name: "تقنية المعلومات", color: PALETTE[7], employees: 18, open: 14, done: 96, perf: 91 },
];

// يشتق كل الإجماليات من الإدارات حتى تبقى الأرقام متسقة وصحيحة دائماً
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
  const present = opts.employees?.present ?? Math.round(total * 0.82);
  const open = departments.reduce((s, d) => s + d.open, 0);
  const done = departments.reduce((s, d) => s + d.done, 0);
  const revenue = opts.finance?.revenue ?? 0;
  const expenses = opts.finance?.expenses ?? 0;
  return {
    source: opts.source,
    orgName: opts.orgName,
    owner: opts.owner ?? COMPANY.owner,
    departments,
    employees: { total, present, absent: total - present },
    tasks: {
      open,
      done,
      completedPct: done + open > 0 ? Math.round((done / (done + open)) * 100) : 0,
      overdue: Math.round(open * 0.15),
    },
    finance: { revenue, expenses, profit: revenue - expenses },
    notifications: { unread: opts.notifications ?? 3 },
    inbox: opts.inbox ?? { newEmails: 5, callsToday: 12 },
    presentNow: opts.presentNow ?? DEFAULT_PRESENT,
    absent: opts.absent ?? DEFAULT_ABSENT,
    recentComms: opts.recentComms,
  };
}

export const MOCK_OS = deriveOsData(MOCK_DEPARTMENTS, { source: "demo", orgName: "منشأتك" });

// توافق مع صفحة المكتب (تستهلك القيم مباشرةً)
export const EMPLOYEES = MOCK_OS.employees;
export const DEPARTMENTS = MOCK_DEPARTMENTS;
export const TASKS = MOCK_OS.tasks;
export const FINANCE = MOCK_OS.finance;
export const NOTIFICATIONS = MOCK_OS.notifications;
export const INBOX = MOCK_OS.inbox;
export const MY_DAILY_TASKS = { unfinished: 12, fromManager: 8, fromDepartments: 15, phone: 6 };

export const fmt = (n: number) => n.toLocaleString("en-US");
