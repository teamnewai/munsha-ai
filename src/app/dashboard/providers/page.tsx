import type { Metadata } from "next";
import { getProviders } from "@/lib/data";
import { EntityList, StatusBadge } from "@/components/dashboard/EntityList";

export const metadata: Metadata = { title: "مزودو الخدمات" };

export default async function Page() {
  const { isReal, rows } = await getProviders();
  return (
    <EntityList
      icon="🛠️"
      title="مزودو الخدمات"
      description="سجل المزودين مع التقييم المركّب (جودة · سعر · موثوقية · سرعة)."
      isReal={isReal}
      addLabel="إضافة مزوّد"
      columns={[
        { key: "name", label: "المزوّد" },
        { key: "category", label: "التخصص" },
        { key: "phone", label: "الهاتف" },
        { key: "score", label: "التقييم المركّب" },
      ]}
      rows={rows.map((p) => ({
        name: <span className="font-medium text-fg">{p.name}</span>,
        category: p.category,
        phone: p.phone,
        score: p.composite_score != null
          ? <StatusBadge tone={p.composite_score >= 4 ? "green" : p.composite_score >= 3 ? "amber" : "rose"}>★ {Number(p.composite_score).toFixed(1)}</StatusBadge>
          : "—",
      }))}
    />
  );
}
