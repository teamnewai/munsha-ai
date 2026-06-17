import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "مزودو الخدمات" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🛠️"
      title="مزودو الخدمات"
      description="سجل مزودي الخدمات مع نظام تقييم مركّب رباعي العوامل."
      features={["سجل المزودين", "تقييم مركّب (جودة/سعر/موثوقية/سرعة)", "ملفات عامة للمزودين", "اكتشاف عبر السوق"]}
    />
  );
}
