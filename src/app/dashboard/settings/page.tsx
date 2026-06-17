import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الإعدادات" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="⚙️"
      title="الإعدادات"
      description="إعدادات المنشأة: اللغة والعملة والمنطقة الزمنية والتفضيلات."
      features={["بيانات المنشأة", "اللغة والعملة", "المنطقة الزمنية", "التفضيلات العامة"]}
    />
  );
}
