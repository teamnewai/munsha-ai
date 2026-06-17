import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "التقارير" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="📑"
      title="التقارير"
      description="مركز تقارير ذكية: المتأخرات والصيانة والإشغال وانتهاء العقود."
      features={["تقرير المتأخرات", "تقرير الإشغال", "انتهاء العقود", "تقارير ذكية بالـ AI"]}
    />
  );
}
