// مُلكي — مولّد المكاتب الافتراضية واللوحات.
// لكل موظف (بشري/ذكاء اصطناعي) يُبنى «مكتب افتراضي» بلوحة تحكم خاصة وشريط جانبي
// ديناميكي مشتق من: الدور، الإدارة، القسم، المسؤوليات، والصلاحيات.

export type DashboardType = "manager" | "department" | "employee" | "ai";

export interface SidebarItem {
  key: string;
  label: string;
  icon: string; // اسم أيقونة lucide
  href: string;
}

export interface OfficeConfig {
  dashboardType: DashboardType;
  deptKey: string;
  deptName: string;
  section: string | null;
  title: string;
  /** الشريط الجانبي المخصّص — مبني ديناميكياً */
  sidebar: SidebarItem[];
  /** الوحدات المفعّلة في المكتب */
  modules: {
    tasks: boolean;
    responsibilities: boolean;
    permissions: boolean;
    documents: boolean;
    forms: boolean;
    reports: boolean;
  };
  responsibilities: string[];
  permissions: string[];
  kpis: string[];
  generatedAt: string;
}

export interface OfficeRoleInput {
  title: string;
  assignee: "human" | "ai";
  isHead?: boolean;
  deptKey: string;
  deptName: string;
  section: string | null;
  duties: string[];
  perms: string[];
  kpis: string[];
}

export function dashboardTypeFor(role: OfficeRoleInput): DashboardType {
  if (role.assignee === "ai") return "ai";
  if (role.isHead) return "manager";
  return "employee";
}

const has = (perms: string[], key: string) => perms.includes(key);

// يبني الشريط الجانبي ديناميكياً حسب الدور/الإدارة/القسم/الصلاحيات
function buildSidebar(type: DashboardType, role: OfficeRoleInput): SidebarItem[] {
  const base = `/offices`;
  const items: SidebarItem[] = [
    { key: "overview", label: "نظرة عامة", icon: "LayoutDashboard", href: `${base}/{id}` },
    { key: "tasks", label: "المهام", icon: "ListChecks", href: `${base}/{id}#tasks` },
    { key: "responsibilities", label: "المسؤوليات", icon: "ClipboardList", href: `${base}/{id}#responsibilities` },
    { key: "documents", label: "المستندات", icon: "Folder", href: `${base}/{id}#documents` },
    { key: "forms", label: "النماذج", icon: "FileText", href: `${base}/{id}#forms` },
  ];

  // الصلاحيات: تُعرض لمن يملك صلاحية إدارة أو اعتماد
  if (has(role.perms, "dept.manage") || has(role.perms, "dept.approve") || role.isHead) {
    items.push({ key: "permissions", label: "الصلاحيات", icon: "KeyRound", href: `${base}/{id}#permissions` });
  }

  // التقارير: للمدراء ومن يملك صلاحية التقارير
  if (type === "manager" || type === "department" || has(role.perms, "reports.view")) {
    items.push({ key: "reports", label: "التقارير", icon: "BarChart3", href: `${base}/{id}#reports` });
  }

  // المالية: لمن يملك صلاحيات مالية
  if (has(role.perms, "fin.view") || has(role.perms, "fin.approve")) {
    items.push({ key: "finance", label: "المالية", icon: "Wallet", href: `${base}/{id}#finance` });
  }

  // الفريق: للمدراء فقط
  if (type === "manager") {
    items.push({ key: "team", label: "الفريق", icon: "Users", href: `${base}/{id}#team` });
    items.push({ key: "approvals", label: "الاعتمادات", icon: "BadgeCheck", href: `${base}/{id}#approvals` });
  }

  // وكلاء الذكاء الاصطناعي: سجل النشاط بدل الفريق
  if (type === "ai") {
    items.push({ key: "activity", label: "سجل النشاط", icon: "Activity", href: `${base}/{id}#activity` });
    items.push({ key: "guardrails", label: "الضوابط", icon: "ShieldCheck", href: `${base}/{id}#guardrails` });
  }

  return items;
}

export function buildOfficeConfig(role: OfficeRoleInput): OfficeConfig {
  const type = dashboardTypeFor(role);
  return {
    dashboardType: type,
    deptKey: role.deptKey,
    deptName: role.deptName,
    section: role.section,
    title: role.title,
    sidebar: buildSidebar(type, role),
    modules: {
      tasks: true,
      responsibilities: role.duties.length > 0,
      permissions: type === "manager" || has(role.perms, "dept.manage"),
      documents: true,
      forms: true,
      reports: type === "manager" || type === "department" || has(role.perms, "reports.view"),
    },
    responsibilities: role.duties,
    permissions: role.perms,
    kpis: role.kpis,
    generatedAt: new Date().toISOString(),
  };
}

export const DASHBOARD_LABEL: Record<DashboardType, string> = {
  manager: "لوحة مدير",
  department: "لوحة إدارة",
  employee: "لوحة موظف",
  ai: "لوحة وكيل ذكاء اصطناعي",
};
