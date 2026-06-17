import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "المستأجرون" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🧑"
      title="المستأجرون"
      description="سجلات المستأجرين وبيانات التواصل والعقود المرتبطة."
      features={["بيانات المستأجرين", "ربط بالعقود", "بوابة خدمة ذاتية", "تقييم ائتماني"]}
    />
  );
}
