import type { Metadata } from "next";
import { getLeads } from "@/lib/data";
import { EntityList, StatusBadge } from "@/components/dashboard/EntityList";
import { fmtFromSAR } from "@/lib/money";

export const metadata: Metadata = { title: "العملاء المحتملون" };

export default async function Page() {
  const { isReal, rows } = await getLeads();
  return (
    <EntityList
      icon="🎯"
      title="العملاء المحتملون"
      description="العملاء المحتملون بنطاق جغرافي محمي (لا تظهر إلا ضمن مناطق تغطيتك)."
      isReal={isReal}
      columns={[
        { key: "kind", label: "النوع" },
        { key: "city", label: "المدينة" },
        { key: "contact", label: "جهة الاتصال" },
        { key: "budget", label: "الميزانية" },
        { key: "score", label: "التقييم" },
        { key: "status", label: "الحالة" },
      ]}
      rows={rows.map((l) => ({
        kind: <span className="font-medium text-fg">{l.kind ?? l.service_category ?? "—"}</span>,
        city: l.city,
        contact: l.contact_name,
        budget: l.budget_max != null ? fmtFromSAR(l.budget_max) : "—",
        score: l.score != null ? <StatusBadge tone={l.score >= 75 ? "green" : l.score >= 50 ? "amber" : "slate"}>{l.score}</StatusBadge> : "—",
        status:
          l.status === "new" ? <StatusBadge tone="brand">جديد</StatusBadge>
          : l.status === "contacted" ? <StatusBadge tone="amber">تم التواصل</StatusBadge>
          : <StatusBadge tone="slate">{l.status ?? "—"}</StatusBadge>,
      }))}
    />
  );
}
