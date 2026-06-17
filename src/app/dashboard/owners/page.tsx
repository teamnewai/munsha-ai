import type { Metadata } from "next";
import { getParties } from "@/lib/data";
import { EntityList } from "@/components/dashboard/EntityList";
import { AddParty } from "@/components/dashboard/AddParty";

export const metadata: Metadata = { title: "الملاك" };

export default async function Page() {
  const { isReal, rows } = await getParties("owner");
  return (
    <EntityList
      icon="🔑"
      title="الملاك"
      description="سجلات الملاك وبيانات التواصل."
      isReal={isReal}
      action={<AddParty partyType="owner" />}
      columns={[
        { key: "name", label: "الاسم" },
        { key: "nid", label: "الهوية / السجل" },
        { key: "phone", label: "الجوال" },
      ]}
      rows={rows.map((p) => ({
        name: <span className="font-medium text-fg">{p.full_name}</span>,
        nid: p.national_id,
        phone: p.phone,
      }))}
    />
  );
}
