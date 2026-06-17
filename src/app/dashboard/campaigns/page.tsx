import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الحملات" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="📣"
      title="الحملات"
      description="محرّك حملات تسويقية عبر البريد والرسائل وواتساب."
      features={["حملات بريد إلكتروني", "حملات رسائل قصيرة", "حملات واتساب", "تحليلات الحملات"]}
    />
  );
}
