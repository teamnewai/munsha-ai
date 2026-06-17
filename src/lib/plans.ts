// مُلكي إدراك — مصدر الحقيقة الواحد للباقات والحدود (المرحلة 13)
// يُستخدم في: صفحة الأسعار العامة + شاشة الفوترة + فرض الحدود عند الإضافة.

export type PlanKey = "free" | "growth" | "professional" | "business" | "enterprise";

export interface Plan {
  key: PlanKey;
  name: string;
  price: number | null; // ريال/شهر — null = مخصص
  highlight?: boolean;
  limits: {
    users: number; // -1 = غير محدود
    properties: number; // -1 = غير محدود
  };
  features: string[];
}

export const PLANS: Plan[] = [
  {
    key: "free",
    name: "المجانية",
    price: 0,
    limits: { users: 2, properties: 2 },
    features: ["مكتب افتراضي", "مستخدمان", "عقاران", "العقود والفواتير الأساسية"],
  },
  {
    key: "growth",
    name: "النمو",
    price: 50,
    limits: { users: 5, properties: 12 },
    features: ["كل مزايا المجانية", "حتى 5 مستخدمين", "حتى 12 عقاراً", "طلبات الصيانة"],
  },
  {
    key: "professional",
    name: "الاحترافية",
    price: 150,
    highlight: true,
    limits: { users: 15, properties: 50 },
    features: ["كل مزايا النمو", "المساعد الذكي «ذو النورين»", "التقارير الذكية", "اتحاد الملاك (HOA)"],
  },
  {
    key: "business",
    name: "الأعمال",
    price: 300,
    limits: { users: 50, properties: 250 },
    features: ["كل مزايا الاحترافية", "تحليلات متقدمة", "نظام التشغيل MULKI OS", "إدارة الفريق والصلاحيات"],
  },
  {
    key: "enterprise",
    name: "المؤسسات",
    price: null,
    limits: { users: -1, properties: -1 },
    features: ["كل مزايا الأعمال", "علامة تجارية خاصة (White-label)", "دعم ذو أولوية", "تعدد الشركات", "حدود مخصّصة"],
  },
];

export const DEFAULT_PLAN: PlanKey = "free";

export function getPlan(key: string | null | undefined): Plan {
  return PLANS.find((p) => p.key === key) ?? PLANS[0];
}

/** هل الحدّ غير محدود؟ */
export const isUnlimited = (limit: number) => limit < 0;

/** صياغة قيمة الحدّ للعرض */
export const fmtLimit = (limit: number) => (isUnlimited(limit) ? "∞" : String(limit));
