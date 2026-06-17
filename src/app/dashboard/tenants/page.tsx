import type { Metadata } from "next";
import { getParties } from "@/lib/data";
import { EntityList } from "@/components/dashboard/EntityList";
import { AddParty } from "@/components/dashboard/AddParty";

export const metadata: Metadata = { title: "المستأجرون" };

export default async function Page() {
  const { isReal, rows } = await getParties("tenant");
  return (
    <EntityList
      icon="🧑"
      title="المستأجرون"
      description="سجلات المستأجرين وبيانات التواصل."
      isReal={isReal}
      action={<AddParty partyType="tenant" />}
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
