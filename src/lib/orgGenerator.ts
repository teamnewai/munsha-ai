// مُلكي — محرّك المعرفة الإدارية (البذرة)
// مرجع: وثيقة «الشجرة» — المرحلة الثانية · Blueprint §5.4
// يولّد هيكلاً تنظيمياً من إدخالين: النشاط وعدد الموظفين.

import { activityByKey } from "./activities";
import { DEPARTMENTS, CORE_DEPTS, type DeptKey, deptByKey } from "./deptMeta";

export type OrgScale = "micro" | "small" | "medium" | "large";

export interface GeneratedSection {
  name: string;
}
export interface GeneratedDept {
  key: DeptKey;
  name: string;
  icon: string;
  isCore: boolean;
  sections: GeneratedSection[];
  roles: string[];
}
export interface GeneratedStructure {
  scale: OrgScale;
  scaleLabel: string;
  model: string;
  departments: GeneratedDept[];
  deptCount: number;
  sectionCount: number;
  roleCount: number;
  version: string;
}

const SCALE_TABLE: { scale: OrgScale; max: number; label: string; model: string }[] = [
  { scale: "micro", max: 5, label: "منشأة متناهية الصغر (1–5)", model: "هيكل بسيط (Simple Structure)" },
  { scale: "small", max: 25, label: "منشأة صغيرة (6–25)", model: "هيكل وظيفي (Functional)، صلاحيات مفوّضة جزئياً" },
  { scale: "medium", max: 100, label: "منشأة متوسطة (26–100)", model: "هيكل قطاعي (Divisional)" },
  { scale: "large", max: Infinity, label: "منشأة كبيرة (101+)", model: "بيروقراطية آلية / Adhocracy حسب النشاط" },
];

/** أقسام فرعية معيارية لكل إدارة (مرجع: Blueprint §5.5 — deriveSections) */
const SECTIONS_BY_DEPT: Partial<Record<DeptKey, string[]>> = {
  finance: ["المحاسبة", "الخزينة", "الموازنة"],
  hr: ["التوظيف", "الرواتب", "التدريب"],
  sales: ["المبيعات الداخلية", "المبيعات الميدانية", "إدارة الحسابات"],
  management: ["المكتب التنفيذي", "التخطيط الاستراتيجي"],
  ops: ["العمليات اليومية", "الجودة"],
  maintenance: ["الصيانة الوقائية", "الصيانة الطارئة"],
  marketing: ["المحتوى", "الحملات"],
  legal: ["العقود", "الامتثال"],
  realestate: ["التأجير", "إدارة الأملاك"],
  it: ["البنية التحتية", "الدعم الفني"],
};

const ROLES_BY_DEPT: Partial<Record<DeptKey, string[]>> = {
  management: ["الرئيس التنفيذي", "مدير المكتب"],
  finance: ["المدير المالي", "محاسب"],
  hr: ["مدير الموارد البشرية", "أخصائي توظيف"],
  sales: ["مدير المبيعات", "مندوب مبيعات"],
  ops: ["مدير العمليات", "منسّق"],
  maintenance: ["مشرف الصيانة", "فني"],
  marketing: ["مدير التسويق", "أخصائي تسويق"],
  legal: ["المستشار القانوني"],
  realestate: ["مدير العقارات", "وكيل تأجير"],
  it: ["مدير التقنية", "مهندس دعم"],
  procurement: ["مدير المشتريات"],
  logistics: ["مدير اللوجستيات"],
  cs: ["مدير خدمة العملاء", "ممثل خدمة"],
  tech: ["مدير المنتج", "مطوّر"],
};

function scaleFor(employees: number): (typeof SCALE_TABLE)[number] {
  return SCALE_TABLE.find((s) => employees <= s.max) ?? SCALE_TABLE[SCALE_TABLE.length - 1];
}

/** رقم إصدار للوثيقة بصيغة BP-YYMMDD-XXXX */
function buildVersion(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BP-${yy}${mm}${dd}-${rand}`;
}

export function generateStructure(
  activityKey: string,
  employees: number,
  extraActivityKeys: string[] = []
): GeneratedStructure {
  const scaleRow = scaleFor(employees);
  const activity = activityByKey(activityKey);

  // الأقسام الأساسية + أقسام النشاط الرئيسي + أنشطة إضافية + الدعم حسب الحجم
  const keys = new Set<DeptKey>(CORE_DEPTS);
  activity?.suggestedDepts.forEach((k) => keys.add(k));
  extraActivityKeys.forEach((ek) => activityByKey(ek)?.suggestedDepts.forEach((k) => keys.add(k)));
  if (scaleRow.scale === "medium" || scaleRow.scale === "large") {
    keys.add("legal");
    keys.add("marketing");
  }
  if (scaleRow.scale === "large") keys.add("it");

  const order = DEPARTMENTS.map((d) => d.key);
  const orderedKeys = [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const departments: GeneratedDept[] = orderedKeys.map((key) => {
    const meta = deptByKey(key)!;
    // المنشآت الأصغر: قسم واحد لكل إدارة؛ الأكبر: كل الأقسام الفرعية
    const allSections = SECTIONS_BY_DEPT[key] ?? [meta.name];
    const sliceCount = scaleRow.scale === "micro" ? 1 : scaleRow.scale === "small" ? 2 : allSections.length;
    return {
      key,
      name: meta.name,
      icon: meta.icon,
      isCore: CORE_DEPTS.includes(key),
      sections: allSections.slice(0, sliceCount).map((name) => ({ name })),
      roles: ROLES_BY_DEPT[key] ?? [meta.name],
    };
  });

  const sectionCount = departments.reduce((s, d) => s + d.sections.length, 0);
  const roleCount = departments.reduce((s, d) => s + d.roles.length, 0);

  return {
    scale: scaleRow.scale,
    scaleLabel: scaleRow.label,
    model: scaleRow.model,
    departments,
    deptCount: departments.length,
    sectionCount,
    roleCount,
    version: buildVersion(),
  };
}
