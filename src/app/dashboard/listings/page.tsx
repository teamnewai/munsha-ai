import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الإعلانات" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="📢"
      title="الإعلانات"
      description="إنشاء إعلانات العقارات بالصور والفيديو والنشر على المنصات."
      features={["إنشاء الإعلانات", "وصف بالذكاء الاصطناعي", "نشر على بوابات العقار", "تحليلات أداء الإعلان"]}
    />
  );
}
