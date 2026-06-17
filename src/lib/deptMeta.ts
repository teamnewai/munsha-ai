// مُلكي — بيانات الأقسام (مرجع: Blueprint §5.4 — 14 نوع قسم)

export type DeptKey =
  | "management"
  | "sales"
  | "maintenance"
  | "finance"
  | "cs"
  | "marketing"
  | "hr"
  | "ops"
  | "legal"
  | "realestate"
  | "it"
  | "tech"
  | "procurement"
  | "logistics";

export interface DeptMeta {
  key: DeptKey;
  name: string;
  icon: string;
  color: string;
}

export const DEPARTMENTS: DeptMeta[] = [
  { key: "management", name: "الإدارة التنفيذية", icon: "🏛️", color: "#1f59e0" },
  { key: "sales", name: "المبيعات وتطوير الأعمال", icon: "📈", color: "#16a34a" },
  { key: "maintenance", name: "الصيانة والمرافق", icon: "🔧", color: "#ea580c" },
  { key: "finance", name: "المالية والمحاسبة", icon: "💰", color: "#d4af37" },
  { key: "cs", name: "خدمة العملاء", icon: "🎧", color: "#0891b2" },
  { key: "marketing", name: "التسويق والاتصال", icon: "📣", color: "#db2777" },
  { key: "hr", name: "الموارد البشرية", icon: "👥", color: "#7c3aed" },
  { key: "ops", name: "العمليات", icon: "⚙️", color: "#475569" },
  { key: "legal", name: "الشؤون القانونية والامتثال", icon: "⚖️", color: "#334155" },
  { key: "realestate", name: "العقارات", icon: "🏢", color: "#0d9488" },
  { key: "it", name: "تقنية المعلومات", icon: "💻", color: "#2563eb" },
  { key: "tech", name: "تطوير المنتجات والتقنية", icon: "🚀", color: "#9333ea" },
  { key: "procurement", name: "المشتريات", icon: "🛒", color: "#ca8a04" },
  { key: "logistics", name: "اللوجستيات وسلسلة الإمداد", icon: "🚚", color: "#0369a1" },
];

/** الأقسام الأساسية الموجودة دائماً (Blueprint §5.4) */
export const CORE_DEPTS: DeptKey[] = ["management", "finance", "hr", "sales", "ops"];

export function deptByKey(key: DeptKey): DeptMeta | undefined {
  return DEPARTMENTS.find((d) => d.key === key);
}
