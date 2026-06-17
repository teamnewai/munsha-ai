import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "العقارات" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🏢"
      title="العقارات"
      description="سجل عقاراتك بمواقعها وأنواعها مع متابعة الوحدات والإشغال."
      features={["إضافة وتعديل العقارات", "ربط الوحدات بكل عقار", "تقييم عقاري بالذكاء الاصطناعي", "جولات افتراضية ثلاثية الأبعاد"]}
    />
  );
}
