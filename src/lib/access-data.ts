import { MOCK_DEPARTMENTS } from "./os-data";

// نموذج الوصول والصلاحيات (بيانات عرض تجريبية)

export type EntityKind = "department" | "employee" | "agent";
export type Entity = { id: string; name: string; role: string; kind: EntityKind };
export type Group = { deptKey: string; deptName: string; color: string; members: Entity[] };

export const PERMISSIONS: { key: string; label: string }[] = [
  { key: "view_reports", label: "عرض التقارير" },
  { key: "approve_tx", label: "اعتماد المعاملات" },
  { key: "manage_staff", label: "إدارة الموظفين" },
  { key: "finance_spend", label: "الصرف المالي" },
  { key: "edit_org", label: "تعديل الهيكل التنظيمي" },
  { key: "manage_perms", label: "إدارة الصلاحيات" },
  { key: "archive_access", label: "الوصول للأرشيف" },
  { key: "manage_forms", label: "إدارة النماذج" },
];

export const GROUPS: Group[] = MOCK_DEPARTMENTS.map((d) => ({
  deptKey: d.key,
  deptName: d.name,
  color: d.color,
  members: [
    { id: `mgr-${d.key}`, name: `مدير ${d.name}`, role: "مدير الإدارة", kind: "employee" },
    { id: `emp-${d.key}`, name: `موظف ${d.name}`, role: "موظف", kind: "employee" },
    { id: `ai-${d.key}`, name: `${d.name} AI`, role: "وكيل ذكاء اصطناعي", kind: "agent" },
  ],
}));

export type AccessRequest = { id: string; from: string; to: string; reason: string; time: string };
export const ACCESS_REQUESTS_SEED: AccessRequest[] = [
  { id: "AR-1", from: "محاسب أول — المالية", to: "المدير المالي", reason: "الاطلاع على تقرير الإدارة الشهري", time: "اليوم 09:20" },
  { id: "AR-2", from: "موظف — المبيعات", to: "مدير المبيعات", reason: "الوصول لمستهدفات الربع", time: "اليوم 08:50" },
  { id: "AR-3", from: "موظف — التشغيل", to: "مدير العمليات", reason: "صلاحية اعتماد طلب صيانة", time: "أمس 16:10" },
];

export type SecretaryMsg = { id: string; from: string; msg: string; time: string };
export const SECRETARY_SEED: SecretaryMsg[] = [
  { id: "M-1", from: "مدير العمليات", msg: "طلب اجتماع عاجل مع المالك بخصوص عقد المورّد", time: "10:15" },
  { id: "M-2", from: "محاسب أول", msg: "استفسار عن اعتماد صرف استثنائي", time: "09:30" },
];
