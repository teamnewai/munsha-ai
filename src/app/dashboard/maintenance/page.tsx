import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الصيانة" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🔧"
      title="الصيانة"
      description="دورة كاملة لطلبات الصيانة مع مستويات موافقة ومؤشر SLA."
      features={["طلب ← عرض ← موافقة ← تنفيذ", "موافقات حسب المبلغ", "تقييم مزودي الخدمة", "صيانة تنبؤية بالذكاء الاصطناعي"]}
    />
  );
}
