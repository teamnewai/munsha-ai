import type { Metadata } from "next";
import { OsPlaceholder } from "@/components/os/OsPlaceholder";

export const metadata: Metadata = { title: "مركز التحكم — MULKI OS" };

export default function Page() {
  return (
    <OsPlaceholder
      icon="🎛️"
      title="مركز التحكم"
      description="صلاحيات المالك والمدير العام: إدارة الخدمات والموظفين والمقاعد وموافقات الحذف."
      features={["سحب/إيقاف/تعديل الخدمة", "منح منصات (مايكروسوفت 365، جوجل...)", "إدارة مقاعد المكتب", "سير عمل موافقات الحذف"]}
    />
  );
}
