import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "العملاء المحتملون" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🎯"
      title="العملاء المحتملون"
      description="إدارة العملاء المحتملين بنطاق جغرافي محمي يمنع التداخل."
      features={["إدارة العملاء", "نطاق جغرافي (RLS)", "تقييم العملاء بالـ AI", "قمع تحويل للعقود"]}
    />
  );
}
