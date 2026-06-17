import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "التحليلات" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="📈"
      title="التحليلات"
      description="تحليلات الإشغال والإيرادات وأداء العقارات والصيانة."
      features={["مؤشرات الإشغال", "تحليل الإيرادات", "أداء العقارات", "مقارنات معيارية"]}
    />
  );
}
