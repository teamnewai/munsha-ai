import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الاشتراك والفوترة" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="💳"
      title="الاشتراك والفوترة"
      description="إدارة الاشتراك والباقة والفواتير وطرق الدفع."
      features={["الباقة الحالية", "ترقية/تخفيض الباقة", "سجل الفواتير", "طرق الدفع"]}
    />
  );
}
