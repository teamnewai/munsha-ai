import type { Metadata } from "next";
import { getProperties } from "@/lib/data";
import { EntityList } from "@/components/dashboard/EntityList";

export const metadata: Metadata = { title: "العقارات" };

export default async function Page() {
  const { isReal, rows } = await getProperties();
  return (
    <EntityList
      icon="🏢"
      title="العقارات"
      description="سجل عقاراتك بمواقعها وأكوادها المرجعية."
      isReal={isReal}
      addLabel="إضافة عقار"
      columns={[
        { key: "ref", label: "الكود" },
        { key: "name", label: "الاسم" },
        { key: "city", label: "المدينة" },
        { key: "district", label: "الحي" },
        { key: "addr", label: "العنوان الوطني" },
      ]}
      rows={rows.map((p) => ({
        ref: p.ref_code,
        name: <span className="font-medium text-slate-900">{p.name}</span>,
        city: p.city,
        district: p.district,
        addr: p.national_address,
      }))}
    />
  );
}
