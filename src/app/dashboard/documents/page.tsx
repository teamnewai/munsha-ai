import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "المستندات" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="📁"
      title="المستندات"
      description="مكتبة مستندات منظّمة مع إصدارات وتحليل ذكي."
      features={["مكتبة المستندات", "إصدارات المستند", "تحليل بالذكاء الاصطناعي", "تتبع انتهاء الصلاحية"]}
    />
  );
}
