// المصدر الموحّد لأرقام مُلكي OS — أرقام متسقة ومترابطة عبر لوحة القيادة والمكتب وكل الأقسام.

export const COMPANY = { owner: "أحمد بن محمد", title: "الرئيس التنفيذي" };

// إجمالي الموظفين = المتواجدون + غير المتواجدين (128 + 28 = 156)
export const EMPLOYEES = { total: 156, present: 128, absent: 28 };

export type Dept = {
  key: string;
  name: string;
  color: string;
  employees: number;
  open: number; // المهام المفتوحة
  done: number; // المهام المكتملة
  perf: number; // الأداء %
};

// مجموع الموظفين عبر الإدارات = 156 (مطابق للإجمالي أعلاه)
export const DEPARTMENTS: Dept[] = [
  { key: "finance", name: "المالية", color: "#10b981", employees: 18, open: 18, done: 142, perf: 92 },
  { key: "hr", name: "الموارد البشرية", color: "#3b82f6", employees: 16, open: 22, done: 108, perf: 88 },
  { key: "sales", name: "المبيعات", color: "#a855f7", employees: 28, open: 31, done: 206, perf: 95 },
  { key: "ops", name: "التشغيل", color: "#f59e0b", employees: 32, open: 27, done: 189, perf: 90 },
  { key: "marketing", name: "التسويق", color: "#ec4899", employees: 14, open: 14, done: 74, perf: 85 },
  { key: "legal", name: "الشؤون القانونية", color: "#8b5cf6", employees: 10, open: 9, done: 58, perf: 87 },
  { key: "realestate", name: "العقارات", color: "#06b6d4", employees: 20, open: 16, done: 120, perf: 89 },
  { key: "it", name: "تقنية المعلومات", color: "#6366f1", employees: 18, open: 14, done: 96, perf: 91 },
];

// إجماليات المهام مشتقّة من الإدارات (حتى تبقى صحيحة دائماً)
const totalOpen = DEPARTMENTS.reduce((s, d) => s + d.open, 0);
const totalDone = DEPARTMENTS.reduce((s, d) => s + d.done, 0);
export const TASKS = {
  open: totalOpen,
  done: totalDone,
  completedPct: Math.round((totalDone / (totalDone + totalOpen)) * 100),
  overdue: 23,
};

// المالية: الأرباح = الإيرادات − المصروفات (محسوبة تلقائياً)
const revenue = 2458000;
const expenses = 1125000;
export const FINANCE = { revenue, expenses, profit: revenue - expenses };

export const NOTIFICATIONS = { unread: 3 };
export const INBOX = { newEmails: 5, callsToday: 12 };

// المهام اليومية للمستخدم (لوحة المكتب)
export const MY_DAILY_TASKS = { unfinished: 12, fromManager: 8, fromDepartments: 15, phone: 6 };

export const fmt = (n: number) => n.toLocaleString("en-US");
