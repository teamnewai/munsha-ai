import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الملاك" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🔑"
      title="الملاك"
      description="سجلات الملاك وربطهم بالعقارات والوحدات ولوحة الاستثمار."
      features={["بيانات الملاك", "ربط بالعقارات", "لوحة استثمار المالك", "صافي الدخل لكل عقار"]}
    />
  );
}
