import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "المالية" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="💰"
      title="المالية"
      description="قوائم مالية كاملة: الأرباح والخسائر والتدفق النقدي والمتأخرات."
      features={["قائمة الأرباح والخسائر", "التدفق النقدي", "إدارة المتأخرات", "تسوية بنكية"]}
    />
  );
}
