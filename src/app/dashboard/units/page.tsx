import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الوحدات" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🚪"
      title="الوحدات"
      description="إدارة الوحدات بأنواعها (شقق، فلل، مكاتب، محلات) وحالات الإشغال."
      features={["أنواع وحدات متعددة", "متابعة حالة الإشغال", "ربط بالعقود والفواتير", "جاهزية عدّادات ذكية (IoT)"]}
    />
  );
}
