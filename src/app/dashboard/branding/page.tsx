import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الهوية التجارية" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🎨"
      title="الهوية التجارية"
      description="علامة تجارية خاصة (White-label): شعارك وألوانك ونطاقك."
      features={["شعار وألوان مخصّصة", "نطاق خاص", "إخفاء هوية مُلكي", "بوابات بعلامتك"]}
    />
  );
}
