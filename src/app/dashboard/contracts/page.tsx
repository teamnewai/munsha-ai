import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "العقود" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="📄"
      title="العقود"
      description="تتبع عقود الإيجار والبيع مع تواريخ البداية والنهاية والتجديد."
      features={["إنشاء وتتبع العقود", "تنبيهات تجديد ذكية", "توقيع إلكتروني (نفاذ)", "تجديد تلقائي للعقود"]}
    />
  );
}
