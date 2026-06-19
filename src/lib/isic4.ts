// مُلكي — كتالوج ISIC4 (التصنيف الصناعي الدولي الموحّد) — قطاعات رئيسية + أنشطة فرعية
// مرجع الدليل الاسترشادي لوزارة التجارة (ISIC4). كل نشاط فرعي مربوط بنموذج هيكل (base)
// من ACTIVITY_CATALOG لتوليد الإدارات المقترحة.

export interface IsicSub {
  code: string;   // رمز ISIC4 (4 خانات)
  name: string;   // النشاط الفرعي
  base: string;   // مفتاح النموذج في ACTIVITY_CATALOG (لتوليد الهيكل)
}
export interface IsicSection {
  code: string;   // A..U
  name: string;   // النشاط الرئيسي (القطاع)
  icon: string;
  subs: IsicSub[];
}

export const ISIC4_SECTIONS: IsicSection[] = [
  { code: "A", name: "الزراعة والحراجة وصيد الأسماك", icon: "🌾", subs: [
    { code: "0111", name: "زراعة الحبوب والبقول", base: "manufacturing" },
    { code: "0130", name: "زراعة المشاتل والنباتات", base: "manufacturing" },
    { code: "0141", name: "تربية المواشي والأبقار", base: "manufacturing" },
    { code: "0146", name: "تربية الدواجن", base: "manufacturing" },
    { code: "0311", name: "صيد الأسماك البحري", base: "logistics" },
  ]},
  { code: "B", name: "التعدين واستغلال المحاجر", icon: "⛏️", subs: [
    { code: "0610", name: "استخراج النفط الخام", base: "manufacturing" },
    { code: "0710", name: "تعدين خامات الحديد", base: "manufacturing" },
    { code: "0810", name: "استغلال محاجر الأحجار والرمل", base: "construction" },
    { code: "0990", name: "خدمات دعم التعدين", base: "services" },
  ]},
  { code: "C", name: "الصناعة التحويلية", icon: "🏭", subs: [
    { code: "1010", name: "تصنيع وحفظ اللحوم", base: "manufacturing" },
    { code: "1071", name: "صناعة المخبوزات", base: "food" },
    { code: "1392", name: "صناعة المنسوجات الجاهزة", base: "manufacturing" },
    { code: "2220", name: "صناعة المنتجات البلاستيكية", base: "manufacturing" },
    { code: "2410", name: "صناعة الحديد والصلب", base: "manufacturing" },
    { code: "3100", name: "صناعة الأثاث", base: "manufacturing" },
  ]},
  { code: "D", name: "إمدادات الكهرباء والغاز والتكييف", icon: "⚡", subs: [
    { code: "3510", name: "توليد ونقل الكهرباء", base: "manufacturing" },
    { code: "3520", name: "إنتاج وتوزيع الغاز", base: "manufacturing" },
    { code: "3530", name: "إمداد البخار والتكييف", base: "services" },
  ]},
  { code: "E", name: "إمدادات المياه والصرف الصحي وإدارة النفايات", icon: "💧", subs: [
    { code: "3600", name: "تجميع ومعالجة وتوزيع المياه", base: "services" },
    { code: "3700", name: "الصرف الصحي", base: "services" },
    { code: "3811", name: "جمع النفايات غير الخطرة", base: "logistics" },
  ]},
  { code: "F", name: "التشييد والمقاولات", icon: "🏗️", subs: [
    { code: "4100", name: "تشييد المباني السكنية وغير السكنية", base: "construction" },
    { code: "4210", name: "إنشاء الطرق والسكك", base: "construction" },
    { code: "4220", name: "إنشاء مشاريع المرافق", base: "construction" },
    { code: "4321", name: "تركيبات الكهرباء", base: "construction" },
    { code: "4322", name: "تركيبات السباكة والتكييف", base: "construction" },
    { code: "4330", name: "أعمال التشطيبات", base: "construction" },
  ]},
  { code: "G", name: "تجارة الجملة والتجزئة", icon: "🛍️", subs: [
    { code: "4510", name: "بيع وصيانة المركبات", base: "retail" },
    { code: "4630", name: "تجارة جملة الأغذية والمشروبات", base: "retail" },
    { code: "4711", name: "التجزئة في المتاجر الكبرى", base: "retail" },
    { code: "4751", name: "تجزئة المنسوجات والملابس", base: "retail" },
    { code: "4791", name: "التجارة الإلكترونية والبيع عبر الإنترنت", base: "retail" },
  ]},
  { code: "H", name: "النقل والتخزين", icon: "🚚", subs: [
    { code: "4923", name: "نقل البضائع بالطرق البرية", base: "logistics" },
    { code: "5210", name: "التخزين والمستودعات", base: "logistics" },
    { code: "5224", name: "مناولة البضائع", base: "logistics" },
    { code: "5320", name: "خدمات البريد والتوصيل", base: "logistics" },
  ]},
  { code: "I", name: "خدمات الإقامة والطعام", icon: "🏨", subs: [
    { code: "5510", name: "الفنادق والمنتجعات", base: "hospitality" },
    { code: "5590", name: "الإقامة الأخرى", base: "hospitality" },
    { code: "5610", name: "المطاعم والمقاهي", base: "food" },
    { code: "5621", name: "خدمات تقديم الطعام (Catering)", base: "food" },
  ]},
  { code: "J", name: "المعلومات والاتصالات", icon: "💻", subs: [
    { code: "5820", name: "نشر البرمجيات", base: "tech" },
    { code: "6110", name: "الاتصالات السلكية", base: "tech" },
    { code: "6201", name: "برمجة الحاسب وتطوير التطبيقات", base: "tech" },
    { code: "6311", name: "معالجة البيانات والاستضافة", base: "tech" },
  ]},
  { code: "K", name: "الأنشطة المالية والتأمين", icon: "🏦", subs: [
    { code: "6419", name: "الوساطة النقدية والبنوك", base: "finance" },
    { code: "6499", name: "أنشطة الخدمات المالية الأخرى", base: "finance" },
    { code: "6511", name: "التأمين على الحياة", base: "finance" },
    { code: "6512", name: "التأمين العام", base: "finance" },
  ]},
  { code: "L", name: "الأنشطة العقارية", icon: "🏢", subs: [
    { code: "6810", name: "بيع وشراء العقارات المملوكة", base: "realestate" },
    { code: "6820", name: "تأجير وإدارة العقارات", base: "realestate" },
    { code: "6831", name: "الوساطة العقارية", base: "realestate" },
    { code: "6832", name: "إدارة الأملاك مقابل أجر", base: "realestate" },
  ]},
  { code: "M", name: "الأنشطة المهنية والعلمية والتقنية", icon: "💼", subs: [
    { code: "6910", name: "الأنشطة القانونية", base: "services" },
    { code: "6920", name: "المحاسبة ومراجعة الحسابات", base: "finance" },
    { code: "7010", name: "أنشطة المكاتب الرئيسية والإدارة", base: "services" },
    { code: "7020", name: "الاستشارات الإدارية", base: "services" },
    { code: "7110", name: "الأنشطة الهندسية والاستشارات الفنية", base: "construction" },
    { code: "7310", name: "الإعلان والتسويق", base: "services" },
  ]},
  { code: "N", name: "الخدمات الإدارية وخدمات الدعم", icon: "🧰", subs: [
    { code: "7710", name: "تأجير المركبات", base: "logistics" },
    { code: "7820", name: "وكالات التوظيف", base: "services" },
    { code: "7911", name: "وكالات السفر", base: "hospitality" },
    { code: "8121", name: "خدمات التنظيف العامة", base: "services" },
    { code: "8110", name: "خدمات دعم المرافق المتكاملة", base: "services" },
  ]},
  { code: "O", name: "الإدارة العامة والدفاع", icon: "🏛️", subs: [
    { code: "8411", name: "أنشطة الإدارة العامة", base: "services" },
    { code: "8413", name: "تنظيم الأنشطة الاقتصادية", base: "services" },
  ]},
  { code: "P", name: "التعليم", icon: "🎓", subs: [
    { code: "8510", name: "التعليم ما قبل الابتدائي والابتدائي", base: "education" },
    { code: "8521", name: "التعليم الثانوي", base: "education" },
    { code: "8530", name: "التعليم العالي", base: "education" },
    { code: "8550", name: "التدريب والتعليم المهني", base: "education" },
  ]},
  { code: "Q", name: "الصحة والعمل الاجتماعي", icon: "🏥", subs: [
    { code: "8610", name: "أنشطة المستشفيات", base: "healthcare" },
    { code: "8620", name: "عيادات الطب والأسنان", base: "healthcare" },
    { code: "8690", name: "أنشطة صحية أخرى", base: "healthcare" },
    { code: "8710", name: "الرعاية التمريضية", base: "healthcare" },
  ]},
  { code: "R", name: "الفنون والترفيه والتسلية", icon: "🎭", subs: [
    { code: "9000", name: "الأنشطة الإبداعية والفنون", base: "services" },
    { code: "9311", name: "تشغيل المرافق الرياضية", base: "hospitality" },
    { code: "9329", name: "أنشطة الترفيه والتسلية", base: "hospitality" },
  ]},
  { code: "S", name: "أنشطة الخدمات الأخرى", icon: "🔧", subs: [
    { code: "9511", name: "إصلاح الحواسيب والأجهزة", base: "tech" },
    { code: "9521", name: "إصلاح الإلكترونيات المنزلية", base: "services" },
    { code: "9602", name: "صالونات الحلاقة والتجميل", base: "services" },
    { code: "9609", name: "خدمات شخصية أخرى", base: "services" },
  ]},
  { code: "T", name: "أنشطة الأسر المعيشية", icon: "🏠", subs: [
    { code: "9700", name: "أنشطة الأسر كأصحاب عمل", base: "services" },
  ]},
  { code: "U", name: "المنظمات والهيئات الدولية", icon: "🌐", subs: [
    { code: "9900", name: "أنشطة المنظمات الدولية", base: "services" },
  ]},
];

// بحث سريع عن نشاط فرعي برمزه
export function isicSubByCode(code: string): { sub: IsicSub; section: IsicSection } | undefined {
  for (const s of ISIC4_SECTIONS) {
    const sub = s.subs.find((x) => x.code === code);
    if (sub) return { sub, section: s };
  }
  return undefined;
}
