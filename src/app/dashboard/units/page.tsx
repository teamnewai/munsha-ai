import type { Metadata } from "next";
import { getUnits } from "@/lib/data";
import { EntityList, StatusBadge } from "@/components/dashboard/EntityList";
import { AddUnit } from "@/components/dashboard/AddUnit";

export const metadata: Metadata = { title: "الوحدات" };

const TYPE_AR: Record<string, string> = {
  apartment: "شقة", room: "غرفة", studio: "استوديو", villa: "فيلا",
  shop: "محل", office: "مكتب", land: "أرض", warehouse: "مستودع",
};

export default async function Page() {
  const { isReal, rows } = await getUnits();
  return (
    <EntityList
      icon="🚪"
      title="الوحدات"
      description="إدارة الوحدات بأنواعها وحالات الإشغال."
      isReal={isReal}
      action={<AddUnit />}
      columns={[
        { key: "no", label: "رقم الوحدة" },
        { key: "type", label: "النوع" },
        { key: "area", label: "المساحة (م²)" },
        { key: "occ", label: "الإشغال" },
      ]}
      rows={rows.map((u) => ({
        no: <span className="font-medium text-fg">{u.unit_no}</span>,
        type: u.unit_type ? (TYPE_AR[u.unit_type] ?? u.unit_type) : "—",
        area: u.area ?? "—",
        occ:
          u.occupancy === "occupied" ? <StatusBadge tone="green">مشغولة</StatusBadge>
          : u.occupancy === "vacant" ? <StatusBadge tone="amber">شاغرة</StatusBadge>
          : <StatusBadge tone="slate">{u.occupancy ?? "—"}</StatusBadge>,
      }))}
    />
  );
}
