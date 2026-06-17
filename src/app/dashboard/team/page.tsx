import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "الفريق" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="👥"
      title="الفريق"
      description="إدارة أعضاء الفريق والأدوار والصلاحيات والدعوات."
      features={["6 أدوار + صلاحيات", "دعوات بكود STF", "صلاحيات على مستوى القسم", "ربط بأقسام نظام التشغيل"]}
    />
  );
}
