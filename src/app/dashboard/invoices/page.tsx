import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الفواتير" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="🧾"
      title="الفواتير"
      description="إصدار ومتابعة الفواتير مع احتساب ضريبة القيمة المضافة 15%."
      features={["إصدار الفواتير", "احتساب ضريبة 15%", "متابعة المدفوع والمتأخر", "فوترة إلكترونية (ZATCA)"]}
    />
  );
}
