// مُلكي — دماغ التوليد: قوالب الهيكل التنظيمي لكل نوع إدارة.
// محتوى حقيقي ومنظّم (أقسام، مسميات وظيفية بواجباتها وصلاحياتها ومؤشراتها،
// موظفون بشريون ووكلاء ذكاء اصطناعي، نماذج، دورات مستندية، مؤشرات أداء).
// لا يعتمد على أي منشأة وهمية — يُستخدم كقالب توليد عند اعتماد المالك للهيكل.

import { DEPARTMENTS, type DeptKey, type DeptMeta } from "@/lib/deptMeta";

export type RoleAssignee = "human" | "ai";

export interface RoleTemplate {
  title: string;
  assignee: RoleAssignee;
  section: string;
  purpose: string;
  reportsTo: string | null;
  qualifications: string;
  duties: string[];
  perms: string[];
  kpis: string[];
  /** رأس الإدارة (مدير) — تُبنى له لوحة مدير */
  isHead?: boolean;
}

export interface FormTemplate {
  title: string;
  description: string;
  fields: { key: string; label: string; type: "text" | "number" | "date" | "select" | "textarea"; required?: boolean; options?: string[] }[];
}

export interface WorkflowTemplate {
  ruleKey: string;
  name: string;
  stages: { name: string; actor: string }[];
}

export interface DeptTemplate {
  key: DeptKey;
  name: string;
  icon: string;
  color: string;
  operationType: string;
  mission: string;
  sections: string[];
  roles: RoleTemplate[];
  forms: FormTemplate[];
  workflows: WorkflowTemplate[];
}

// ─── صلاحيات عامة (مفاتيح) ─────────────────────────────────────────────────────
const P = {
  view: "dept.view",
  manage: "dept.manage",
  approve: "dept.approve",
  docCreate: "doc.create",
  docSign: "doc.sign",
  finView: "fin.view",
  finApprove: "fin.approve",
  hrManage: "hr.manage",
  hrPayroll: "hr.payroll",
  govAudit: "gov.audit",
  reports: "reports.view",
  tasksAssign: "tasks.assign",
};

// ─── مولّد عام لإدارة (مدير بشري + موظف + وكيل ذكاء اصطناعي) ─────────────────────
function genericDept(
  meta: DeptMeta,
  opts: {
    operationType: string;
    mission: string;
    sections: string[];
    headTitle: string;
    headDuties: string[];
    headKpis: string[];
    headPerms: string[];
    staff: { title: string; section: string; duties: string[]; kpis: string[]; perms: string[] }[];
    ai: { title: string; purpose: string; duties: string[] };
    forms: FormTemplate[];
    workflows: WorkflowTemplate[];
  },
): DeptTemplate {
  const roles: RoleTemplate[] = [];
  roles.push({
    title: opts.headTitle,
    assignee: "human",
    section: opts.sections[0],
    purpose: opts.mission,
    reportsTo: "المدير العام",
    qualifications: "خبرة قيادية لا تقل عن ٧ سنوات في المجال + مؤهل جامعي ذو صلة.",
    duties: opts.headDuties,
    perms: opts.headPerms,
    kpis: opts.headKpis,
    isHead: true,
  });
  for (const s of opts.staff) {
    roles.push({
      title: s.title,
      assignee: "human",
      section: s.section,
      purpose: `تنفيذ مهام ${s.title} ضمن ${meta.name}.`,
      reportsTo: opts.headTitle,
      qualifications: "مؤهل جامعي ذو صلة + خبرة عملية مناسبة.",
      duties: s.duties,
      perms: s.perms,
      kpis: s.kpis,
    });
  }
  roles.push({
    title: opts.ai.title,
    assignee: "ai",
    section: opts.sections[0],
    purpose: opts.ai.purpose,
    reportsTo: opts.headTitle,
    qualifications: "وكيل ذكاء اصطناعي — يعمل تحت إشراف رأس الإدارة وبحدود صلاحياته.",
    duties: opts.ai.duties,
    perms: [P.view, P.reports],
    kpis: ["دقة المعالجة ≥ 98%", "زمن استجابة فوري", "نسبة تصعيد للبشر < 10%"],
  });

  return {
    key: meta.key,
    name: meta.name,
    icon: meta.icon,
    color: meta.color,
    operationType: opts.operationType,
    mission: opts.mission,
    sections: opts.sections,
    roles,
    forms: opts.forms,
    workflows: opts.workflows,
  };
}

// ─── قاموس القوالب لكل إدارة ────────────────────────────────────────────────────
const META = Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d])) as Record<DeptKey, DeptMeta>;

const TEMPLATES: Record<DeptKey, DeptTemplate> = {
  management: genericDept(META.management, {
    operationType: "strategic",
    mission: "رسم التوجه الاستراتيجي للمنشأة والإشراف على الأداء العام واتخاذ القرارات الكبرى.",
    sections: ["المكتب التنفيذي", "التخطيط الاستراتيجي", "حوكمة الأداء"],
    headTitle: "المدير العام",
    headDuties: ["اعتماد الاستراتيجية السنوية", "متابعة مؤشرات الأداء العامة", "اعتماد القرارات الكبرى", "تمثيل المنشأة أمام الجهات"],
    headKpis: ["تحقيق أهداف الخطة السنوية ≥ 90%", "نمو الإيرادات ≥ 15%", "رضا أصحاب المصلحة ≥ 90%"],
    headPerms: [P.manage, P.approve, P.docSign, P.finApprove, P.govAudit, P.reports, P.tasksAssign],
    staff: [
      { title: "مدير مكتب الإدارة", section: "المكتب التنفيذي", duties: ["تنسيق أعمال المكتب التنفيذي", "إعداد جداول الاجتماعات", "متابعة تنفيذ القرارات"], kpis: ["نسبة تنفيذ القرارات في وقتها ≥ 95%"], perms: [P.docCreate, P.reports, P.tasksAssign] },
      { title: "محلل تخطيط استراتيجي", section: "التخطيط الاستراتيجي", duties: ["إعداد الدراسات والتحليلات", "متابعة مؤشرات الخطة", "إعداد تقارير الأداء"], kpis: ["دقة التقارير ≥ 98%"], perms: [P.view, P.reports] },
    ],
    ai: { title: "وكيل التحليل التنفيذي الذكي", purpose: "تجميع وتحليل مؤشرات الأداء وإعداد ملخصات تنفيذية فورية للمدير العام.", duties: ["رصد مؤشرات الأداء آلياً", "تنبيه عند الانحرافات", "إعداد ملخصات تنفيذية يومية"] },
    forms: [
      { title: "قرار إداري", description: "نموذج إصدار قرار إداري معتمد.", fields: [{ key: "subject", label: "الموضوع", type: "text", required: true }, { key: "body", label: "نص القرار", type: "textarea", required: true }, { key: "effective", label: "تاريخ النفاذ", type: "date" }] },
      { title: "محضر اجتماع", description: "توثيق محاضر الاجتماعات والقرارات.", fields: [{ key: "title", label: "عنوان الاجتماع", type: "text", required: true }, { key: "attendees", label: "الحضور", type: "textarea" }, { key: "decisions", label: "القرارات", type: "textarea" }] },
    ],
    workflows: [
      { ruleKey: "exec_decision_cycle", name: "دورة اعتماد القرارات التنفيذية", stages: [{ name: "إعداد القرار", actor: "مدير مكتب الإدارة" }, { name: "مراجعة", actor: "محلل تخطيط استراتيجي" }, { name: "اعتماد", actor: "المدير العام" }] },
    ],
  }),

  finance: genericDept(META.finance, {
    operationType: "support",
    mission: "إدارة الموارد المالية وضمان الاستدامة المالية والشفافية في جميع المعاملات.",
    sections: ["المحاسبة", "الميزانية والتخطيط", "المدفوعات والتحصيل"],
    headTitle: "المدير المالي",
    headDuties: ["إعداد الموازنة السنوية", "الإشراف على التقارير المالية", "إدارة التدفقات النقدية", "اعتماد المصروفات الكبرى"],
    headKpis: ["دقة التقارير المالية ≥ 99%", "خفض التكاليف التشغيلية ≥ 8%", "الالتزام بمواعيد الإقفال الشهري"],
    headPerms: [P.manage, P.finApprove, P.finView, P.docSign, P.approve, P.reports],
    staff: [
      { title: "محاسب أول", section: "المحاسبة", duties: ["تسجيل القيود اليومية", "مطابقة الحسابات البنكية", "إعداد القوائم المالية"], kpis: ["إقفال شهري في الوقت المحدد"], perms: [P.finView, P.docCreate] },
      { title: "أخصائي مدفوعات وتحصيل", section: "المدفوعات والتحصيل", duties: ["تنفيذ المدفوعات", "متابعة التحصيل", "تسوية الذمم"], kpis: ["نسبة التحصيل ≥ 95%"], perms: [P.finView, P.docCreate] },
    ],
    ai: { title: "وكيل المراجعة المالية الذكي", purpose: "مراجعة آلية للمعاملات المالية وكشف الانحرافات والاحتيال.", duties: ["فحص المعاملات تلقائياً", "رصد المخالفات المالية", "تنبيه عند تجاوز الموازنة"] },
    forms: [
      { title: "طلب صرف", description: "نموذج طلب صرف مالي.", fields: [{ key: "amount", label: "المبلغ", type: "number", required: true }, { key: "purpose", label: "الغرض", type: "text", required: true }, { key: "beneficiary", label: "المستفيد", type: "text" }] },
      { title: "أمر دفع", description: "إصدار أمر دفع معتمد.", fields: [{ key: "invoice_no", label: "رقم الفاتورة", type: "text" }, { key: "amount", label: "المبلغ", type: "number", required: true }, { key: "due", label: "تاريخ الاستحقاق", type: "date" }] },
    ],
    workflows: [
      { ruleKey: "expense_approval_cycle", name: "دورة اعتماد المصروفات", stages: [{ name: "تقديم الطلب", actor: "الموظف" }, { name: "مراجعة المحاسبة", actor: "محاسب أول" }, { name: "اعتماد المدير المالي", actor: "المدير المالي" }] },
    ],
  }),

  hr: genericDept(META.hr, {
    operationType: "support",
    mission: "استقطاب وتطوير الكوادر البشرية وضمان بيئة عمل محفّزة ومنتجة.",
    sections: ["التوظيف", "التدريب والتطوير", "شؤون الموظفين"],
    headTitle: "مدير الموارد البشرية",
    headDuties: ["إدارة سياسات التوظيف", "تطوير برامج الحوافز", "الإشراف على الرواتب", "متابعة الأداء الوظيفي"],
    headKpis: ["معدل الاحتفاظ بالموظفين ≥ 92%", "مدة شغل الوظائف < 30 يوم", "رضا الموظفين ≥ 85%"],
    headPerms: [P.manage, P.hrManage, P.hrPayroll, P.docSign, P.approve, P.reports],
    staff: [
      { title: "أخصائي توظيف", section: "التوظيف", duties: ["فرز السير الذاتية", "إجراء المقابلات", "إنهاء إجراءات التعيين"], kpis: ["مدة التوظيف < 30 يوم"], perms: [P.hrManage, P.docCreate] },
      { title: "أخصائي تدريب وتطوير", section: "التدريب والتطوير", duties: ["تصميم برامج التدريب", "تقييم احتياجات التطوير", "متابعة أثر التدريب"], kpis: ["تغطية تدريبية ≥ 80% من الموظفين"], perms: [P.view, P.docCreate] },
    ],
    ai: { title: "وكيل فرز المتقدمين الذكي", purpose: "فرز السير الذاتية ومطابقتها مع متطلبات الوظائف آلياً.", duties: ["تحليل السير الذاتية", "ترتيب المتقدمين حسب الملاءمة", "جدولة المقابلات"] },
    forms: [
      { title: "طلب إجازة", description: "نموذج طلب إجازة.", fields: [{ key: "type", label: "نوع الإجازة", type: "select", options: ["سنوية", "مرضية", "اضطرارية"], required: true }, { key: "from", label: "من", type: "date", required: true }, { key: "to", label: "إلى", type: "date", required: true }] },
      { title: "طلب توظيف", description: "طلب استحداث/شغل وظيفة.", fields: [{ key: "title", label: "المسمى", type: "text", required: true }, { key: "dept", label: "الإدارة", type: "text" }, { key: "count", label: "العدد", type: "number" }] },
    ],
    workflows: [
      { ruleKey: "leave_approval_cycle", name: "دورة اعتماد الإجازات", stages: [{ name: "تقديم الطلب", actor: "الموظف" }, { name: "موافقة المدير المباشر", actor: "المدير المباشر" }, { name: "اعتماد الموارد البشرية", actor: "مدير الموارد البشرية" }] },
    ],
  }),

  sales: genericDept(META.sales, {
    operationType: "revenue",
    mission: "تطوير قنوات المبيعات وتنمية الأعمال وزيادة الحصة السوقية.",
    sections: ["المبيعات المباشرة", "تطوير الأعمال", "إدارة الحسابات"],
    headTitle: "مدير المبيعات وتطوير الأعمال",
    headDuties: ["وضع خطط المبيعات", "إدارة فريق المبيعات", "تطوير الشراكات", "متابعة الأهداف"],
    headKpis: ["نمو المبيعات ≥ 15% سنوياً", "تحقيق المستهدف الربعي", "معدل تحويل الفرص ≥ 25%"],
    headPerms: [P.manage, P.docCreate, P.finView, P.approve, P.reports, P.tasksAssign],
    staff: [
      { title: "أخصائي مبيعات", section: "المبيعات المباشرة", duties: ["متابعة العملاء المحتملين", "إعداد العروض", "إغلاق الصفقات"], kpis: ["تحقيق المستهدف الشهري"], perms: [P.docCreate, P.view] },
      { title: "مدير حساب", section: "إدارة الحسابات", duties: ["إدارة علاقات العملاء", "تجديد العقود", "تنمية الحسابات"], kpis: ["معدل تجديد العقود ≥ 90%"], perms: [P.docCreate, P.view] },
    ],
    ai: { title: "وكيل تأهيل الفرص الذكي", purpose: "تأهيل العملاء المحتملين وترتيبهم حسب احتمالية الإغلاق.", duties: ["تحليل الفرص", "ترتيب الأولويات", "اقتراح خطوات المتابعة"] },
    forms: [
      { title: "عرض سعر", description: "إصدار عرض سعر للعميل.", fields: [{ key: "client", label: "العميل", type: "text", required: true }, { key: "items", label: "البنود", type: "textarea" }, { key: "total", label: "الإجمالي", type: "number" }] },
      { title: "بطاقة فرصة بيعية", description: "تسجيل فرصة بيعية جديدة.", fields: [{ key: "name", label: "اسم الفرصة", type: "text", required: true }, { key: "value", label: "القيمة المتوقعة", type: "number" }, { key: "stage", label: "المرحلة", type: "select", options: ["جديدة", "تفاوض", "إغلاق"] }] },
    ],
    workflows: [
      { ruleKey: "quote_approval_cycle", name: "دورة اعتماد عروض الأسعار", stages: [{ name: "إعداد العرض", actor: "أخصائي مبيعات" }, { name: "مراجعة الخصومات", actor: "مدير المبيعات وتطوير الأعمال" }, { name: "إرسال للعميل", actor: "أخصائي مبيعات" }] },
    ],
  }),

  ops: genericDept(META.ops, {
    operationType: "core",
    mission: "الإشراف على العمليات التشغيلية اليومية وضمان جودة الخدمات المقدمة.",
    sections: ["التشغيل", "ضبط الجودة", "تخطيط العمليات"],
    headTitle: "مدير العمليات",
    headDuties: ["تحسين العمليات", "إدارة الجودة التشغيلية", "متابعة مؤشرات الإنتاجية", "إدارة الموارد التشغيلية"],
    headKpis: ["رضا العملاء ≥ 90%", "كفاءة تشغيلية ≥ 85%", "خفض زمن الدورة ≥ 10%"],
    headPerms: [P.manage, P.docCreate, P.approve, P.govAudit, P.reports, P.tasksAssign],
    staff: [
      { title: "أخصائي عمليات", section: "التشغيل", duties: ["تنفيذ الإجراءات التشغيلية", "متابعة سير العمل", "حل المعوقات"], kpis: ["الالتزام بالإجراءات ≥ 95%"], perms: [P.docCreate, P.view] },
      { title: "مراقب جودة", section: "ضبط الجودة", duties: ["فحص الجودة", "توثيق المخالفات", "متابعة الإجراءات التصحيحية"], kpis: ["نسبة المطابقة ≥ 98%"], perms: [P.view, P.govAudit] },
    ],
    ai: { title: "وكيل مراقبة العمليات الذكي", purpose: "رصد مؤشرات التشغيل وكشف الاختناقات آلياً.", duties: ["مراقبة المؤشرات لحظياً", "كشف الاختناقات", "اقتراح تحسينات"] },
    forms: [
      { title: "بلاغ تشغيلي", description: "تسجيل بلاغ/عطل تشغيلي.", fields: [{ key: "area", label: "الموقع", type: "text", required: true }, { key: "issue", label: "المشكلة", type: "textarea", required: true }, { key: "priority", label: "الأولوية", type: "select", options: ["عالية", "متوسطة", "منخفضة"] }] },
      { title: "تقرير جودة", description: "تقرير فحص جودة.", fields: [{ key: "subject", label: "موضوع الفحص", type: "text", required: true }, { key: "result", label: "النتيجة", type: "select", options: ["مطابق", "غير مطابق"] }, { key: "notes", label: "ملاحظات", type: "textarea" }] },
    ],
    workflows: [
      { ruleKey: "ops_ticket_cycle", name: "دورة معالجة البلاغات التشغيلية", stages: [{ name: "استلام البلاغ", actor: "أخصائي عمليات" }, { name: "المعالجة", actor: "أخصائي عمليات" }, { name: "تأكيد الإغلاق", actor: "مدير العمليات" }] },
    ],
  }),

  cs: genericDept(META.cs, {
    operationType: "support",
    mission: "تقديم تجربة عملاء متميزة ومعالجة الطلبات والشكاوى بكفاءة.",
    sections: ["الدعم الهاتفي", "الدعم الرقمي", "إدارة الشكاوى"],
    headTitle: "مدير خدمة العملاء",
    headDuties: ["إدارة فريق الدعم", "تطوير معايير الخدمة", "متابعة رضا العملاء", "معالجة التصعيدات"],
    headKpis: ["رضا العملاء ≥ 90%", "زمن المعالجة < 24 ساعة", "نسبة حل أول اتصال ≥ 80%"],
    headPerms: [P.manage, P.docCreate, P.approve, P.reports, P.tasksAssign],
    staff: [
      { title: "موظف خدمة عملاء", section: "الدعم الهاتفي", duties: ["استقبال الطلبات", "حل الاستفسارات", "توثيق التفاعلات"], kpis: ["نسبة حل أول اتصال ≥ 80%"], perms: [P.docCreate, P.view] },
      { title: "أخصائي شكاوى", section: "إدارة الشكاوى", duties: ["تحليل الشكاوى", "متابعة الحلول", "إغلاق الشكاوى"], kpis: ["زمن إغلاق الشكوى < 48 ساعة"], perms: [P.docCreate, P.view] },
    ],
    ai: { title: "وكيل الرد الفوري الذكي", purpose: "الرد على استفسارات العملاء المتكررة وتصنيف الطلبات آلياً.", duties: ["الرد على الاستفسارات", "تصنيف الطلبات", "تحويل المعقّد للبشر"] },
    forms: [
      { title: "تذكرة دعم", description: "فتح تذكرة دعم عميل.", fields: [{ key: "customer", label: "العميل", type: "text", required: true }, { key: "subject", label: "الموضوع", type: "text", required: true }, { key: "details", label: "التفاصيل", type: "textarea" }] },
      { title: "نموذج شكوى", description: "تسجيل شكوى.", fields: [{ key: "customer", label: "العميل", type: "text", required: true }, { key: "complaint", label: "الشكوى", type: "textarea", required: true }] },
    ],
    workflows: [
      { ruleKey: "support_ticket_cycle", name: "دورة معالجة تذاكر الدعم", stages: [{ name: "فتح التذكرة", actor: "موظف خدمة عملاء" }, { name: "المعالجة", actor: "موظف خدمة عملاء" }, { name: "إغلاق وتقييم", actor: "مدير خدمة العملاء" }] },
    ],
  }),

  marketing: genericDept(META.marketing, {
    operationType: "support",
    mission: "بناء العلامة التجارية وتنفيذ الحملات التسويقية وإدارة قنوات الاتصال.",
    sections: ["التسويق الرقمي", "المحتوى والإبداع", "العلاقات العامة"],
    headTitle: "مدير التسويق والاتصال",
    headDuties: ["وضع الخطة التسويقية", "إدارة الحملات", "إدارة الهوية والعلامة", "قياس العائد التسويقي"],
    headKpis: ["نمو الوعي بالعلامة ≥ 20%", "عائد الإنفاق التسويقي ≥ 3x", "نمو التفاعل الرقمي ≥ 25%"],
    headPerms: [P.manage, P.docCreate, P.finView, P.approve, P.reports, P.tasksAssign],
    staff: [
      { title: "أخصائي تسويق رقمي", section: "التسويق الرقمي", duties: ["إدارة الحملات الرقمية", "تحسين محركات البحث", "تحليل الأداء"], kpis: ["معدل التحويل ≥ 3%"], perms: [P.docCreate, P.view] },
      { title: "صانع محتوى", section: "المحتوى والإبداع", duties: ["إنتاج المحتوى", "إدارة التقويم التحريري", "تصميم المواد"], kpis: ["انتظام النشر ≥ 95%"], perms: [P.docCreate, P.view] },
    ],
    ai: { title: "وكيل توليد المحتوى الذكي", purpose: "توليد مسودات المحتوى التسويقي واقتراح أفكار الحملات.", duties: ["توليد مسودات المحتوى", "اقتراح أفكار حملات", "تحليل الاتجاهات"] },
    forms: [
      { title: "خطة حملة", description: "إعداد خطة حملة تسويقية.", fields: [{ key: "name", label: "اسم الحملة", type: "text", required: true }, { key: "budget", label: "الميزانية", type: "number" }, { key: "goals", label: "الأهداف", type: "textarea" }] },
      { title: "طلب تصميم", description: "طلب مادة تصميمية.", fields: [{ key: "type", label: "نوع المادة", type: "text", required: true }, { key: "brief", label: "الموجز", type: "textarea" }, { key: "due", label: "الموعد", type: "date" }] },
    ],
    workflows: [
      { ruleKey: "campaign_approval_cycle", name: "دورة اعتماد الحملات", stages: [{ name: "إعداد الخطة", actor: "أخصائي تسويق رقمي" }, { name: "مراجعة الميزانية", actor: "مدير التسويق والاتصال" }, { name: "الإطلاق", actor: "أخصائي تسويق رقمي" }] },
    ],
  }),

  legal: genericDept(META.legal, {
    operationType: "support",
    mission: "حماية المنشأة قانونياً وضمان الامتثال للأنظمة وإدارة العقود والمخاطر القانونية.",
    sections: ["العقود", "الامتثال", "التقاضي والاستشارات"],
    headTitle: "المستشار القانوني",
    headDuties: ["مراجعة العقود", "إدارة الامتثال", "تمثيل المنشأة قانونياً", "إدارة المخاطر القانونية"],
    headKpis: ["نسبة الامتثال 100%", "زمن مراجعة العقود < 5 أيام", "صفر مخالفات نظامية"],
    headPerms: [P.manage, P.docSign, P.docCreate, P.approve, P.govAudit, P.reports],
    staff: [
      { title: "أخصائي عقود", section: "العقود", duties: ["صياغة العقود", "مراجعة الشروط", "أرشفة العقود"], kpis: ["دقة الصياغة ≥ 99%"], perms: [P.docCreate, P.view] },
      { title: "أخصائي امتثال", section: "الامتثال", duties: ["متابعة الأنظمة", "تقييم الامتثال", "إعداد تقارير الامتثال"], kpis: ["تغطية مراجعة الامتثال ≥ 95%"], perms: [P.view, P.govAudit] },
    ],
    ai: { title: "وكيل مراجعة العقود الذكي", purpose: "مراجعة العقود آلياً وكشف البنود الخطرة والثغرات.", duties: ["تحليل بنود العقود", "كشف المخاطر", "اقتراح تعديلات"] },
    forms: [
      { title: "طلب مراجعة عقد", description: "طلب مراجعة قانونية لعقد.", fields: [{ key: "party", label: "الطرف الآخر", type: "text", required: true }, { key: "type", label: "نوع العقد", type: "text" }, { key: "notes", label: "ملاحظات", type: "textarea" }] },
      { title: "استشارة قانونية", description: "طلب استشارة قانونية.", fields: [{ key: "subject", label: "الموضوع", type: "text", required: true }, { key: "question", label: "الاستفسار", type: "textarea", required: true }] },
    ],
    workflows: [
      { ruleKey: "contract_review_cycle", name: "دورة مراجعة واعتماد العقود", stages: [{ name: "تقديم العقد", actor: "أخصائي عقود" }, { name: "المراجعة القانونية", actor: "المستشار القانوني" }, { name: "الاعتماد والتوقيع", actor: "المدير العام" }] },
    ],
  }),

  it: genericDept(META.it, {
    operationType: "support",
    mission: "تطوير وتشغيل البنية التقنية وأنظمة المعلومات ودعم التحول الرقمي وأمن المعلومات.",
    sections: ["البنية التحتية", "الدعم الفني", "أمن المعلومات"],
    headTitle: "مدير تقنية المعلومات",
    headDuties: ["إدارة البنية التحتية", "أمن المعلومات", "إدارة الأنظمة", "دعم التحول الرقمي"],
    headKpis: ["جاهزية الأنظمة ≥ 99.9%", "زمن حل الأعطال < 4 ساعات", "صفر اختراقات أمنية"],
    headPerms: [P.manage, P.docCreate, P.approve, P.govAudit, P.reports, P.tasksAssign],
    staff: [
      { title: "أخصائي دعم فني", section: "الدعم الفني", duties: ["معالجة طلبات الدعم", "صيانة الأجهزة", "إدارة الحسابات"], kpis: ["زمن الاستجابة < 2 ساعة"], perms: [P.docCreate, P.view] },
      { title: "أخصائي أمن معلومات", section: "أمن المعلومات", duties: ["مراقبة التهديدات", "إدارة الصلاحيات", "تطبيق السياسات الأمنية"], kpis: ["صفر حوادث أمنية حرجة"], perms: [P.view, P.govAudit] },
    ],
    ai: { title: "وكيل المراقبة الأمنية الذكي", purpose: "مراقبة الأنظمة وكشف التهديدات الأمنية والشذوذ آلياً.", duties: ["مراقبة الأنظمة لحظياً", "كشف الشذوذ", "تنبيه الفريق الأمني"] },
    forms: [
      { title: "طلب دعم فني", description: "فتح طلب دعم تقني.", fields: [{ key: "issue", label: "المشكلة", type: "textarea", required: true }, { key: "device", label: "الجهاز/النظام", type: "text" }, { key: "priority", label: "الأولوية", type: "select", options: ["عالية", "متوسطة", "منخفضة"] }] },
      { title: "طلب صلاحية وصول", description: "طلب منح صلاحية على نظام.", fields: [{ key: "system", label: "النظام", type: "text", required: true }, { key: "level", label: "مستوى الصلاحية", type: "text" }, { key: "reason", label: "المبرر", type: "textarea" }] },
    ],
    workflows: [
      { ruleKey: "it_support_cycle", name: "دورة معالجة طلبات الدعم الفني", stages: [{ name: "فتح الطلب", actor: "الموظف" }, { name: "المعالجة", actor: "أخصائي دعم فني" }, { name: "الإغلاق", actor: "مدير تقنية المعلومات" }] },
    ],
  }),

  maintenance: genericDept(META.maintenance, {
    operationType: "core",
    mission: "إدارة صيانة المرافق والأصول وضمان جاهزيتها وكفاءتها التشغيلية.",
    sections: ["الصيانة الوقائية", "الصيانة الطارئة", "إدارة المرافق"],
    headTitle: "مدير الصيانة والمرافق",
    headDuties: ["وضع خطط الصيانة", "إدارة فرق الصيانة", "متابعة جاهزية الأصول", "إدارة عقود المقاولين"],
    headKpis: ["جاهزية الأصول ≥ 95%", "إنجاز الصيانة الوقائية ≥ 90%", "زمن الاستجابة الطارئة < 4 ساعات"],
    headPerms: [P.manage, P.docCreate, P.approve, P.finView, P.reports, P.tasksAssign],
    staff: [
      { title: "فني صيانة", section: "الصيانة الطارئة", duties: ["تنفيذ أعمال الصيانة", "إصلاح الأعطال", "توثيق الأعمال"], kpis: ["نسبة إنجاز الأوامر ≥ 95%"], perms: [P.docCreate, P.view] },
      { title: "مخطط صيانة وقائية", section: "الصيانة الوقائية", duties: ["جدولة الصيانة الوقائية", "متابعة قطع الغيار", "تحليل الأعطال المتكررة"], kpis: ["التزام بالجدول ≥ 90%"], perms: [P.docCreate, P.view] },
    ],
    ai: { title: "وكيل الصيانة التنبؤية الذكي", purpose: "التنبؤ بالأعطال وجدولة الصيانة الوقائية آلياً.", duties: ["تحليل بيانات الأصول", "التنبؤ بالأعطال", "اقتراح جداول الصيانة"] },
    forms: [
      { title: "أمر عمل صيانة", description: "إصدار أمر عمل صيانة.", fields: [{ key: "asset", label: "الأصل/الموقع", type: "text", required: true }, { key: "fault", label: "العطل", type: "textarea", required: true }, { key: "priority", label: "الأولوية", type: "select", options: ["عاجل", "عادي"] }] },
      { title: "طلب قطع غيار", description: "طلب صرف قطع غيار.", fields: [{ key: "part", label: "القطعة", type: "text", required: true }, { key: "qty", label: "الكمية", type: "number" }] },
    ],
    workflows: [
      { ruleKey: "maintenance_wo_cycle", name: "دورة أوامر الصيانة", stages: [{ name: "فتح الأمر", actor: "مخطط صيانة وقائية" }, { name: "التنفيذ", actor: "فني صيانة" }, { name: "التأكيد والإغلاق", actor: "مدير الصيانة والمرافق" }] },
    ],
  }),

  realestate: genericDept(META.realestate, {
    operationType: "revenue",
    mission: "إدارة المحفظة العقارية وعمليات الوساطة وإدارة الممتلكات وتعظيم العوائد.",
    sections: ["الوساطة العقارية", "إدارة الأملاك", "التطوير العقاري"],
    headTitle: "مدير العقارات",
    headDuties: ["تطوير المحفظة العقارية", "متابعة عقود الإيجار", "إدارة عمليات الوساطة", "تعظيم العوائد"],
    headKpis: ["نسبة الإشغال ≥ 95%", "نمو الإيرادات العقارية ≥ 12%", "معدل تجديد العقود ≥ 90%"],
    headPerms: [P.manage, P.docSign, P.docCreate, P.finView, P.approve, P.reports],
    staff: [
      { title: "وسيط عقاري", section: "الوساطة العقارية", duties: ["تسويق العقارات", "إجراء المعاينات", "إتمام الصفقات"], kpis: ["عدد الصفقات الشهرية"], perms: [P.docCreate, P.view] },
      { title: "مدير أملاك", section: "إدارة الأملاك", duties: ["إدارة العقود", "متابعة التحصيل", "الإشراف على الصيانة"], kpis: ["نسبة التحصيل ≥ 95%"], perms: [P.docCreate, P.view] },
    ],
    ai: { title: "وكيل التقييم العقاري الذكي", purpose: "تقييم العقارات وتحليل السوق واقتراح الأسعار آلياً.", duties: ["تحليل أسعار السوق", "تقييم العقارات", "اقتراح فرص استثمارية"] },
    forms: [
      { title: "عقد إيجار", description: "إصدار عقد إيجار.", fields: [{ key: "tenant", label: "المستأجر", type: "text", required: true }, { key: "unit", label: "الوحدة", type: "text", required: true }, { key: "rent", label: "الإيجار", type: "number" }, { key: "term", label: "المدة", type: "text" }] },
      { title: "طلب معاينة", description: "جدولة معاينة عقار.", fields: [{ key: "client", label: "العميل", type: "text", required: true }, { key: "property", label: "العقار", type: "text" }, { key: "date", label: "الموعد", type: "date" }] },
    ],
    workflows: [
      { ruleKey: "lease_contract_cycle", name: "دورة عقد الإيجار", stages: [{ name: "إعداد العقد", actor: "وسيط عقاري" }, { name: "المراجعة القانونية", actor: "المستشار القانوني" }, { name: "الاعتماد", actor: "مدير العقارات" }] },
    ],
  }),

  tech: genericDept(META.tech, {
    operationType: "core",
    mission: "تطوير المنتجات الرقمية وقيادة الابتكار التقني وإدارة دورة حياة المنتج.",
    sections: ["تطوير البرمجيات", "إدارة المنتج", "ضمان الجودة"],
    headTitle: "مدير تطوير المنتجات والتقنية",
    headDuties: ["وضع خارطة طريق المنتج", "إدارة فرق التطوير", "ضمان جودة المنتجات", "قيادة الابتكار"],
    headKpis: ["تسليم في الموعد ≥ 90%", "جودة الإصدارات (عيوب < 2%)", "رضا المستخدمين ≥ 85%"],
    headPerms: [P.manage, P.docCreate, P.approve, P.reports, P.tasksAssign],
    staff: [
      { title: "مطوّر برمجيات", section: "تطوير البرمجيات", duties: ["كتابة الأكواد", "مراجعة الأكواد", "إصلاح العيوب"], kpis: ["إنجاز المهام في السبرنت ≥ 90%"], perms: [P.docCreate, P.view] },
      { title: "مدير منتج", section: "إدارة المنتج", duties: ["تحديد المتطلبات", "ترتيب الأولويات", "متابعة الإصدارات"], kpis: ["تحقيق أهداف المنتج"], perms: [P.docCreate, P.view] },
    ],
    ai: { title: "وكيل مراجعة الأكواد الذكي", purpose: "مراجعة الأكواد آلياً واكتشاف العيوب واقتراح التحسينات.", duties: ["مراجعة الأكواد", "كشف العيوب", "اقتراح تحسينات"] },
    forms: [
      { title: "طلب ميزة", description: "اقتراح/طلب ميزة جديدة.", fields: [{ key: "title", label: "العنوان", type: "text", required: true }, { key: "desc", label: "الوصف", type: "textarea" }, { key: "priority", label: "الأولوية", type: "select", options: ["عالية", "متوسطة", "منخفضة"] }] },
      { title: "بلاغ عيب", description: "تسجيل عيب برمجي.", fields: [{ key: "summary", label: "الملخص", type: "text", required: true }, { key: "steps", label: "خطوات إعادة الإنتاج", type: "textarea" }] },
    ],
    workflows: [
      { ruleKey: "feature_delivery_cycle", name: "دورة تسليم الميزات", stages: [{ name: "تحديد المتطلب", actor: "مدير منتج" }, { name: "التطوير", actor: "مطوّر برمجيات" }, { name: "ضمان الجودة والإطلاق", actor: "مدير تطوير المنتجات والتقنية" }] },
    ],
  }),

  procurement: genericDept(META.procurement, {
    operationType: "support",
    mission: "إدارة المشتريات والموردين وضمان أفضل قيمة بأقل تكلفة وفق السياسات.",
    sections: ["المشتريات", "إدارة الموردين", "العقود والتوريد"],
    headTitle: "مدير المشتريات",
    headDuties: ["إدارة دورة الشراء", "التفاوض مع الموردين", "اعتماد أوامر الشراء", "إدارة العقود"],
    headKpis: ["توفير في التكاليف ≥ 10%", "زمن دورة الشراء < 7 أيام", "رضا الإدارات الداخلية ≥ 90%"],
    headPerms: [P.manage, P.docCreate, P.finView, P.approve, P.reports, P.tasksAssign],
    staff: [
      { title: "أخصائي مشتريات", section: "المشتريات", duties: ["إعداد أوامر الشراء", "مقارنة العروض", "متابعة التوريد"], kpis: ["دقة أوامر الشراء ≥ 98%"], perms: [P.docCreate, P.view] },
      { title: "أخصائي موردين", section: "إدارة الموردين", duties: ["تأهيل الموردين", "تقييم الأداء", "إدارة قاعدة الموردين"], kpis: ["نسبة الموردين المؤهلين ≥ 95%"], perms: [P.docCreate, P.view] },
    ],
    ai: { title: "وكيل تحليل العروض الذكي", purpose: "مقارنة عروض الموردين آلياً واقتراح الأفضل قيمة.", duties: ["تحليل العروض", "مقارنة الأسعار", "اقتراح أفضل قيمة"] },
    forms: [
      { title: "طلب شراء", description: "طلب شراء داخلي.", fields: [{ key: "item", label: "الصنف", type: "text", required: true }, { key: "qty", label: "الكمية", type: "number" }, { key: "justification", label: "المبرر", type: "textarea" }] },
      { title: "أمر شراء", description: "إصدار أمر شراء لمورد.", fields: [{ key: "supplier", label: "المورد", type: "text", required: true }, { key: "total", label: "الإجمالي", type: "number" }, { key: "delivery", label: "موعد التسليم", type: "date" }] },
    ],
    workflows: [
      { ruleKey: "purchase_order_cycle", name: "دورة أوامر الشراء", stages: [{ name: "طلب الشراء", actor: "الموظف" }, { name: "مقارنة العروض", actor: "أخصائي مشتريات" }, { name: "اعتماد الأمر", actor: "مدير المشتريات" }] },
    ],
  }),

  logistics: genericDept(META.logistics, {
    operationType: "core",
    mission: "إدارة سلسلة الإمداد والمستودعات والتوزيع وضمان كفاءة التدفق اللوجستي.",
    sections: ["المستودعات", "النقل والتوزيع", "تخطيط الإمداد"],
    headTitle: "مدير اللوجستيات وسلسلة الإمداد",
    headDuties: ["إدارة المخزون", "تخطيط النقل", "تحسين سلسلة الإمداد", "إدارة المستودعات"],
    headKpis: ["دقة المخزون ≥ 98%", "التسليم في الموعد ≥ 95%", "خفض تكلفة النقل ≥ 8%"],
    headPerms: [P.manage, P.docCreate, P.finView, P.approve, P.reports, P.tasksAssign],
    staff: [
      { title: "أمين مستودع", section: "المستودعات", duties: ["استلام وصرف الأصناف", "الجرد الدوري", "تنظيم المخزون"], kpis: ["دقة الجرد ≥ 98%"], perms: [P.docCreate, P.view] },
      { title: "منسق نقل وتوزيع", section: "النقل والتوزيع", duties: ["جدولة الشحنات", "متابعة التوصيل", "تحسين المسارات"], kpis: ["التسليم في الموعد ≥ 95%"], perms: [P.docCreate, P.view] },
    ],
    ai: { title: "وكيل تحسين المسارات الذكي", purpose: "تحسين مسارات التوزيع وتوقع احتياجات المخزون آلياً.", duties: ["تحسين مسارات التوزيع", "توقع الطلب", "تنبيه عند نقص المخزون"] },
    forms: [
      { title: "إذن صرف مخزون", description: "صرف أصناف من المستودع.", fields: [{ key: "item", label: "الصنف", type: "text", required: true }, { key: "qty", label: "الكمية", type: "number", required: true }, { key: "to", label: "الجهة الطالبة", type: "text" }] },
      { title: "أمر شحن", description: "إصدار أمر شحن/توصيل.", fields: [{ key: "destination", label: "الوجهة", type: "text", required: true }, { key: "items", label: "المحتويات", type: "textarea" }, { key: "date", label: "موعد الشحن", type: "date" }] },
    ],
    workflows: [
      { ruleKey: "shipment_cycle", name: "دورة الشحن والتوزيع", stages: [{ name: "إعداد الشحنة", actor: "أمين مستودع" }, { name: "النقل", actor: "منسق نقل وتوزيع" }, { name: "تأكيد التسليم", actor: "مدير اللوجستيات وسلسلة الإمداد" }] },
    ],
  }),
};

export function getDeptTemplate(key: DeptKey): DeptTemplate {
  return TEMPLATES[key];
}

export function allDeptTemplates(): DeptTemplate[] {
  return DEPARTMENTS.map((d) => TEMPLATES[d.key]);
}

export type { DeptKey };
