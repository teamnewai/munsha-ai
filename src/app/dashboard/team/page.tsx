import type { Metadata } from "next";
import { getTeam } from "@/lib/data";
import { EntityList, StatusBadge } from "@/components/dashboard/EntityList";

export const metadata: Metadata = { title: "الفريق" };

export default async function Page() {
  const { isReal, rows } = await getTeam();
  return (
    <EntityList
      icon="👥"
      title="الفريق"
      description="أعضاء الفريق وأقسامهم ومناصبهم وحالاتهم."
      isReal={isReal}
      addLabel="دعوة عضو"
      columns={[
        { key: "name", label: "الاسم" },
        { key: "job", label: "المنصب" },
        { key: "section", label: "القسم" },
        { key: "present", label: "الحضور" },
        { key: "status", label: "الحالة" },
      ]}
      rows={rows.map((m) => ({
        name: <span className="font-medium text-fg">{m.full_name}</span>,
        job: m.job_title,
        section: m.section,
        present: m.present ? <StatusBadge tone="green">متواجد</StatusBadge> : <StatusBadge tone="slate">غائب</StatusBadge>,
        status: m.status === "active" ? <StatusBadge tone="brand">نشط</StatusBadge> : <StatusBadge tone="rose">موقوف</StatusBadge>,
      }))}
    />
  );
}
