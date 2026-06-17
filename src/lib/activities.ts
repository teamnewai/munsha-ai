// مُلكي — كتالوج الأنشطة بتصنيف ISIC4 (مرجع: Blueprint §5.3, §12)

import type { DeptKey } from "./deptMeta";

export interface Activity {
  code: string; // ISIC4
  key: string;
  name: string;
  icon: string;
  /** أقسام مقترحة إضافة على الأقسام الأساسية */
  suggestedDepts: DeptKey[];
}

export const ACTIVITY_CATALOG: Activity[] = [
  { code: "6810", key: "realestate", name: "العقارات وإدارة الأملاك", icon: "🏢", suggestedDepts: ["realestate", "maintenance", "legal"] },
  { code: "4711", key: "retail", name: "التجزئة والتجارة الإلكترونية", icon: "🛍️", suggestedDepts: ["procurement", "logistics", "marketing"] },
  { code: "5510", key: "hospitality", name: "الضيافة والسياحة", icon: "🏨", suggestedDepts: ["cs", "maintenance", "marketing"] },
  { code: "8610", key: "healthcare", name: "الرعاية الصحية", icon: "🏥", suggestedDepts: ["cs", "legal", "it"] },
  { code: "8500", key: "education", name: "التعليم والتدريب", icon: "🎓", suggestedDepts: ["cs", "marketing", "it"] },
  { code: "2500", key: "manufacturing", name: "التصنيع", icon: "🏭", suggestedDepts: ["procurement", "logistics", "ops"] },
  { code: "4900", key: "logistics", name: "النقل واللوجستيات", icon: "🚚", suggestedDepts: ["logistics", "ops", "procurement"] },
  { code: "6499", key: "finance", name: "الخدمات المالية", icon: "🏦", suggestedDepts: ["legal", "it", "cs"] },
  { code: "6201", key: "tech", name: "التقنية والبرمجيات", icon: "💻", suggestedDepts: ["tech", "it", "marketing"] },
  { code: "4100", key: "construction", name: "الإنشاء والمقاولات", icon: "🏗️", suggestedDepts: ["procurement", "maintenance", "legal"] },
  { code: "5610", key: "food", name: "الأغذية والمطاعم", icon: "🍽️", suggestedDepts: ["procurement", "cs", "marketing"] },
  { code: "7020", key: "services", name: "الخدمات المهنية العامة", icon: "💼", suggestedDepts: ["legal", "marketing", "it"] },
];

/** المدن حسب الدولة (مرجع: Blueprint §5.3 — CITIES_BY_COUNTRY) */
export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  SA: ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الطائف", "أبها", "تبوك", "بريدة"],
  AE: ["دبي", "أبوظبي", "الشارقة", "العين", "عجمان", "رأس الخيمة"],
  KW: ["مدينة الكويت", "حولي", "الفروانية", "الأحمدي"],
  BH: ["المنامة", "المحرق", "الرفاع"],
  QA: ["الدوحة", "الريان", "الوكرة"],
  OM: ["مسقط", "صلالة", "صحار", "نزوى"],
};

export function activityByKey(key: string): Activity | undefined {
  return ACTIVITY_CATALOG.find((a) => a.key === key);
}
