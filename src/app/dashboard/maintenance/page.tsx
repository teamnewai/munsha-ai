import type { Metadata } from "next";
import { getMaintenance } from "@/lib/data";
import { EntityList, StatusBadge } from "@/components/dashboard/EntityList";
import { fmtFromSAR } from "@/lib/money";

export const metadata: Metadata = { title: "الصيانة" };

export default async function Page() {
  const { isReal, rows } = await getMaintenance();
  return (
    <EntityList
      icon="🔧"
      title="الصيانة"
      description="طلبات الصيانة مع التكلفة التقديرية ومستوى الموافقة (تلقائي ≤500 · مدير ≤2000 · مالك >2000)."
      isReal={isReal}
      addLabel="طلب صيانة"
      columns={[
        { key: "title", label: "الطلب" },
        { key: "cost", label: "التكلفة التقديرية" },
        { key: "level", label: "مستوى الموافقة" },
        { key: "status", label: "الحالة" },
      ]}
      rows={rows.map((m) => ({
        title: <span className="font-medium text-fg">{m.title}</span>,
        cost: m.estimated_cost != null ? fmtFromSAR(m.estimated_cost) : "—",
        level:
          m.approval_level === "auto" ? <StatusBadge tone="green">تلقائي</StatusBadge>
          : m.approval_level === "manager" ? <StatusBadge tone="amber">مدير</StatusBadge>
          : m.approval_level === "owner" ? <StatusBadge tone="rose">مالك</StatusBadge>
          : <StatusBadge tone="slate">{m.approval_level ?? "—"}</StatusBadge>,
        status:
          m.status === "in_progress" ? <StatusBadge tone="brand">قيد التنفيذ</StatusBadge>
          : m.status === "done" ? <StatusBadge tone="green">منجز</StatusBadge>
          : <StatusBadge tone="amber">مفتوح</StatusBadge>,
      }))}
    />
  );
}
