import type { Metadata } from "next";
import { OsPlaceholder } from "@/components/os/OsPlaceholder";

export const metadata: Metadata = { title: "مولّد المعرفة الإدارية — MULKI OS" };

export default function Page() {
  return (
    <OsPlaceholder
      icon="🧬"
      title="مولّد المعرفة الإدارية"
      description="توليد هيكل تنظيمي مثالي من النشاط وعدد الموظفين، مبني على أطر COSO/OECD/RACI/Mintzberg."
      features={["توليد محلي فوري ومجاني", "توليد مُعزّز بالذكاء الاصطناعي", "تبويب الحوكمة (RACI، اللجان)", "إصدار وثيقة مدفوعة"]}
    />
  );
}
