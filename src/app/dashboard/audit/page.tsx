import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "سجل التدقيق" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🔒"
      title="سجل التدقيق"
      description="سجل تدقيق غير قابل للتعديل لكل العمليات الحساسة."
      features={["سجل غير قابل للتعديل", "من فعل ماذا ومتى", "بحث في السجل", "تقارير امتثال"]}
    />
  );
}
