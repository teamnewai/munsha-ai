import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Briefcase, Users, BarChart3, Workflow, FileText, Calendar,
  Brain, ClipboardList, Bot, KeyRound, Building2, Inbox, Target, Activity, Mail,
} from "lucide-react";

// توليد لوحة وقائمة جانبية لكل دور تلقائياً (مبنية على الدور/المهام/الصلاحيات)

export type Role = "owner" | "manager" | "employee" | "agent";

export function deriveRole(kind?: string, role?: string): Role {
  if (!kind) return "owner";
  if (kind === "agent") return "agent";
  if (role && role.includes("مدير")) return "manager";
  return "employee";
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "المالك", manager: "مدير الإدارة", employee: "موظف", agent: "وكيل ذكاء اصطناعي",
};

export type Nav = { to: string; label: string; icon: LucideIcon };

// القائمة الجانبية الديناميكية حسب الدور (لغير المالك)
export function navForRole(role: Role, workspaceHref: string): Nav[] {
  if (role === "manager") return [
    { to: workspaceHref, label: "لوحتي", icon: LayoutDashboard },
    { to: "/people", label: "موظفو الإدارة", icon: Users },
    { to: "/reports", label: "تقارير ومؤشرات", icon: BarChart3 },
    { to: "/workflows", label: "الاعتمادات", icon: Workflow },
    { to: "/forms", label: "النماذج", icon: FileText },
    { to: "/meetings", label: "الاجتماعات", icon: Calendar },
  ];
  if (role === "agent") return [
    { to: workspaceHref, label: "لوحة الوكيل", icon: Bot },
    { to: "/workflows", label: "المهام المسندة", icon: ClipboardList },
    { to: "/reports", label: "التحليلات والتقارير", icon: BarChart3 },
    { to: "/knowledge", label: "العقل المعرفي", icon: Brain },
  ];
  // employee
  return [
    { to: workspaceHref, label: "لوحتي", icon: LayoutDashboard },
    { to: "/office", label: "مكتبي", icon: Briefcase },
    { to: "/workflows", label: "مهامي وطلباتي", icon: ClipboardList },
    { to: "/meetings", label: "الاجتماعات", icon: Calendar },
    { to: "/forms", label: "النماذج", icon: FileText },
    { to: "/service-requests", label: "طلب خدمة", icon: Inbox },
  ];
}

export type Section = { title: string; icon: LucideIcon; lines: string[] };

// محتوى لوحة كل دور (مطابق للمخطط)
export const SECTIONS: Record<Role, Section[]> = {
  owner: [
    { title: "لوحة التحكم الشاملة", icon: LayoutDashboard, lines: ["متابعة جميع المستويات", "المؤشرات التنفيذية", "مقارنة الإدارات"] },
  ],
  manager: [
    { title: "لوحة تحكم الإدارة", icon: LayoutDashboard, lines: ["أداء الإدارة العام", "المهام المفتوحة/المكتملة", "التنبيهات العاجلة"] },
    { title: "إدارة الموظفين والصلاحيات", icon: Users, lines: ["قائمة الموظفين", "توزيع المهام", "منح الصلاحيات"] },
    { title: "المؤشرات والتقارير", icon: BarChart3, lines: ["مؤشرات الأداء KPI", "التقارير الشهرية", "المستهدفات"] },
    { title: "الاعتمادات والوثائق", icon: Workflow, lines: ["المعاملات بانتظار الاعتماد", "الدورات المستندية", "الأرشيف"] },
  ],
  employee: [
    { title: "لوحة الموظف", icon: LayoutDashboard, lines: ["ملخص يومي", "إنجازي", "ساعات العمل"] },
    { title: "المهام والطلبات المخصصة", icon: ClipboardList, lines: ["مهامي اليوم", "الإحالات", "طلباتي"] },
    { title: "البريد والاجتماعات", icon: Mail, lines: ["الوارد", "اجتماعاتي", "التذكيرات"] },
    { title: "الملفات والنماذج", icon: FileText, lines: ["ملفاتي", "النماذج", "الاعتمادات الخاصة"] },
  ],
  agent: [
    { title: "لوحة تحكم الوكيل", icon: Bot, lines: ["الحالة: نشط", "المهام الجارية", "الاستهلاك"] },
    { title: "المهام المسندة للوكيل", icon: ClipboardList, lines: ["قائمة المهام", "الأولويات", "المهلة الزمنية"] },
    { title: "التحليلات والتوصيات", icon: Target, lines: ["توصيات ذكية", "اكتشاف مخاطر", "فرص تحسين"] },
    { title: "سجل النشاط والأداء", icon: Activity, lines: ["آخر الإجراءات", "دقة الأداء", "التقارير الذكية"] },
  ],
};

export const ROLE_ICON: Record<Role, LucideIcon> = {
  owner: Building2, manager: Briefcase, employee: Users, agent: Bot,
};
export { KeyRound };
