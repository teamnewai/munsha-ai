import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "اتحاد الملاك" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🏘️"
      title="اتحاد الملاك"
      description="إدارة الرسوم والتصويت على القرارات وحجز المرافق المشتركة."
      features={["رسوم الاتحاد", "تصويت على القرارات", "حجز المرافق", "محاضر اجتماعات المجلس"]}
    />
  );
}
