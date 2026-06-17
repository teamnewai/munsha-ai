import type { Metadata } from "next";
import { OsPlaceholder } from "@/components/os/OsPlaceholder";

export const metadata: Metadata = { title: "الهيكل التنظيمي — MULKI OS" };

export default function Page() {
  return (
    <OsPlaceholder
      icon="🗂️"
      title="الهيكل التنظيمي"
      description="وثيقة الهيكل الرسمية القابلة للطباعة: إدارات وأقسام ومناصب ومهام وصلاحيات."
      features={["عرض الهيكل الكامل", "وثيقة رسمية برقم وختم", "تصدير PDF عربي", "وضع التحرير"]}
    />
  );
}
