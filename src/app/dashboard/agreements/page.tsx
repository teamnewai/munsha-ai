import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الاتفاقيات" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="✍️"
      title="الاتفاقيات"
      description="مكتبة قوالب الاتفاقيات وبناء العقود والتوقيع الرقمي."
      features={["مكتبة قوالب", "باني الاتفاقيات", "توقيع رقمي", "تذكير انتهاء تلقائي"]}
    />
  );
}
