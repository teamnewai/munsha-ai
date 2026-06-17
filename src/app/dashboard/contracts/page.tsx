import type { Metadata } from "next";
import { getContracts } from "@/lib/data";
import { EntityList, StatusBadge } from "@/components/dashboard/EntityList";
import { fmtFromSAR } from "@/lib/money";

export const metadata: Metadata = { title: "العقود" };

export default async function Page() {
  const { isReal, rows } = await getContracts();
  return (
    <EntityList
      icon="📄"
      title="العقود"
      description="عقود الإيجار مع الإيجار السنوي وتواريخ البداية والنهاية."
      isReal={isReal}
      addLabel="عقد جديد"
      columns={[
        { key: "rent", label: "الإيجار السنوي" },
        { key: "period", label: "الفترة" },
        { key: "start", label: "البداية" },
        { key: "end", label: "النهاية" },
        { key: "status", label: "الحالة" },
      ]}
      rows={rows.map((c) => ({
        rent: <span className="font-bold text-fg">{c.annual_rent != null ? fmtFromSAR(c.annual_rent) : "—"}</span>,
        period: c.period,
        start: c.start_date,
        end: c.end_date,
        status:
          c.status === "active" ? <StatusBadge tone="green">نشط</StatusBadge>
          : c.status === "expired" ? <StatusBadge tone="slate">منتهٍ</StatusBadge>
          : <StatusBadge tone="amber">{c.status ?? "—"}</StatusBadge>,
      }))}
    />
  );
}
