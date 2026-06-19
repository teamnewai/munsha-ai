// دليل المنشآت المزوّدة (بيانات عرض تجريبية) — لتوجيه طلبات الخدمات للمنشأة المناسبة.

export type Category = { key: string; label: string; emoji: string; desc: string };

export const CATEGORIES: Category[] = [
  { key: "financial", label: "استشارات مالية", emoji: "📊", desc: "تخطيط مالي · تمويل · دراسات جدوى" },
  { key: "legal", label: "استشارات قانونية", emoji: "⚖️", desc: "عقود · امتثال · تقاضٍ" },
  { key: "admin", label: "استشارات إدارية", emoji: "🗂️", desc: "تنظيم · حوكمة · جودة" },
  { key: "tech", label: "استشارات تقنية", emoji: "💻", desc: "أنظمة · تحول رقمي · أمن" },
  { key: "ai", label: "حلول الذكاء الاصطناعي", emoji: "🤖", desc: "أتمتة · وكلاء · تحليل بيانات" },
  { key: "accounting", label: "محاسبة ومالية", emoji: "🧾", desc: "محاسبة · رواتب · ضريبة" },
  { key: "gov", label: "خدمات حكومية", emoji: "🛎️", desc: "دوائر · منصات · تراخيص" },
  { key: "insurance", label: "تأمين", emoji: "🛡️", desc: "بوالص · مطالبات" },
  { key: "rent", label: "وحدات للإيجار", emoji: "🏠", desc: "شقق · مكاتب · مستودعات" },
  { key: "maintenance", label: "صيانة", emoji: "🔧", desc: "صيانة · ترميم · تكييف" },
  { key: "cleaning", label: "نظافة", emoji: "🧹", desc: "تنظيف · تعقيم" },
  { key: "contractor", label: "مقاولات", emoji: "👷", desc: "بناء · تشطيب" },
  { key: "financing", label: "بنوك وتمويل", emoji: "🏦", desc: "تمويل · حسابات · ضمانات" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export type Provider = {
  name: string; category: string; city: string; specialty: string;
  rating: number; jobs: number; verified: boolean;
};

export const PROVIDERS: Provider[] = [
  // استشارات مالية
  { name: "بيت الخبرة المالية", category: "financial", city: "الرياض", specialty: "تخطيط مالي ودراسات جدوى", rating: 4.9, jobs: 312, verified: true },
  { name: "مكتب الرواد للاستشارات المالية", category: "financial", city: "جدة", specialty: "تمويل وإعادة هيكلة", rating: 4.7, jobs: 198, verified: true },
  { name: "ذروة للاستشارات الاقتصادية", category: "financial", city: "الدمام", specialty: "تحليل استثماري", rating: 4.6, jobs: 121, verified: false },
  // قانونية
  { name: "مكتب العدالة للمحاماة", category: "legal", city: "الرياض", specialty: "عقود وتحكيم تجاري", rating: 4.8, jobs: 276, verified: true },
  { name: "الميزان للاستشارات القانونية", category: "legal", city: "جدة", specialty: "امتثال وحوكمة", rating: 4.5, jobs: 143, verified: true },
  { name: "حصين للمحاماة", category: "legal", city: "الرياض", specialty: "تقاضٍ وملكية فكرية", rating: 4.4, jobs: 97, verified: false },
  // إدارية
  { name: "إتقان للاستشارات الإدارية", category: "admin", city: "الرياض", specialty: "تنظيم وحوكمة", rating: 4.7, jobs: 165, verified: true },
  { name: "مسار للتطوير المؤسسي", category: "admin", city: "الخبر", specialty: "جودة وإجراءات", rating: 4.6, jobs: 88, verified: true },
  // تقنية
  { name: "نُظُم لحلول الأعمال", category: "tech", city: "الرياض", specialty: "أنظمة ERP وتحول رقمي", rating: 4.8, jobs: 209, verified: true },
  { name: "سايبر شيلد للأمن السيبراني", category: "tech", city: "جدة", specialty: "أمن المعلومات", rating: 4.7, jobs: 134, verified: true },
  // AI
  { name: "ذكاء للحلول الذكية", category: "ai", city: "الرياض", specialty: "وكلاء وأتمتة", rating: 4.9, jobs: 156, verified: true },
  { name: "نبراس AI", category: "ai", city: "الدمام", specialty: "تحليل بيانات ونماذج", rating: 4.6, jobs: 73, verified: false },
  // محاسبة
  { name: "الأرقام للمحاسبة", category: "accounting", city: "الرياض", specialty: "محاسبة ورواتب", rating: 4.7, jobs: 241, verified: true },
  { name: "ميزانية للخدمات المالية", category: "accounting", city: "جدة", specialty: "ضريبة القيمة المضافة والزكاة", rating: 4.5, jobs: 118, verified: true },
  // حكومية
  { name: "إنجاز للخدمات الحكومية", category: "gov", city: "الرياض", specialty: "تراخيص ومنصات حكومية", rating: 4.6, jobs: 187, verified: true },
  { name: "تيسير للمعقّبات", category: "gov", city: "مكة", specialty: "تعقيب ودوائر", rating: 4.3, jobs: 64, verified: false },
  // تأمين
  { name: "أمان للوساطة التأمينية", category: "insurance", city: "الرياض", specialty: "بوالص ومطالبات", rating: 4.5, jobs: 132, verified: true },
  { name: "درع للتأمين", category: "insurance", city: "جدة", specialty: "تأمين منشآت", rating: 4.4, jobs: 79, verified: true },
  // وحدات
  { name: "مجموعة الرياض العقارية", category: "rent", city: "الرياض", specialty: "شقق ومكاتب", rating: 4.6, jobs: 420, verified: true },
  { name: "دار التمليك", category: "rent", city: "جدة", specialty: "فلل ووحدات سكنية", rating: 4.5, jobs: 263, verified: true },
  // صيانة
  { name: "إتقان للصيانة والمرافق", category: "maintenance", city: "الرياض", specialty: "صيانة شاملة وتكييف", rating: 4.7, jobs: 512, verified: true },
  { name: "خبراء الصيانة", category: "maintenance", city: "الدمام", specialty: "ترميم وكهرباء", rating: 4.4, jobs: 201, verified: false },
  // نظافة
  { name: "نقاء لخدمات النظافة", category: "cleaning", city: "الرياض", specialty: "تنظيف وتعقيم", rating: 4.6, jobs: 339, verified: true },
  { name: "بريق للتنظيف", category: "cleaning", city: "جدة", specialty: "تنظيف منشآت", rating: 4.3, jobs: 142, verified: false },
  // مقاولات
  { name: "البنيان للمقاولات", category: "contractor", city: "الرياض", specialty: "بناء وتشطيب", rating: 4.7, jobs: 176, verified: true },
  { name: "إعمار الديار", category: "contractor", city: "جدة", specialty: "تشطيبات فاخرة", rating: 4.5, jobs: 98, verified: true },
  // بنوك وتمويل
  { name: "البنك الأهلي", category: "financing", city: "الرياض", specialty: "حسابات وتمويل المنشآت", rating: 4.6, jobs: 980, verified: true },
  { name: "مصرف الراجحي", category: "financing", city: "الرياض", specialty: "تمويل ومصرفية الشركات", rating: 4.7, jobs: 1120, verified: true },
  { name: "بنك الرياض", category: "financing", city: "الرياض", specialty: "تمويل تجاري", rating: 4.5, jobs: 640, verified: true },
  { name: "البنك السعودي الأول", category: "financing", city: "جدة", specialty: "حلول مصرفية للشركات", rating: 4.4, jobs: 410, verified: true },
  { name: "صندوق التنمية العقارية", category: "financing", city: "الرياض", specialty: "تمويل عقاري", rating: 4.3, jobs: 305, verified: true },
  { name: "بنك التنمية الاجتماعية", category: "financing", city: "الرياض", specialty: "تمويل اجتماعي وأسري", rating: 4.2, jobs: 288, verified: true },
  { name: "كفالة — تمويل المنشآت", category: "financing", city: "الرياض", specialty: "ضمان تمويل المنشآت الصغيرة", rating: 4.5, jobs: 222, verified: true },
  { name: "منشآت — الهيئة العامة", category: "financing", city: "الرياض", specialty: "دعم المنشآت الصغيرة والمتوسطة", rating: 4.4, jobs: 176, verified: true },
];

export function providersByCategory(key: string): Provider[] {
  return PROVIDERS.filter((p) => p.category === key);
}
