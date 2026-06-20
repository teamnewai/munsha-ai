// مُلكي — كتالوج الصلاحيات المرجعي فقط. لا بيانات منشآت/أشخاص وهمية هنا.

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
