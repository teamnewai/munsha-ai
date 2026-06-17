import type { Metadata } from "next";
import { OsPlaceholder } from "@/components/os/OsPlaceholder";

export const metadata: Metadata = { title: "المكتب الافتراضي — MULKI OS" };

export default function Page() {
  return (
    <OsPlaceholder
      icon="🪑"
      title="المكتب الافتراضي"
      description="مكتب الموظف الذكي: مساعد شخصي، 15 أداة مكتبية، مهام اليوم، والمعاملات المرتجعة."
      features={["مساعد شخصي ذكي (نور)", "15 أداة مكتبية (أوفيس 365، التقويم، البريد...)", "مهام اليوم والمعاملات المرتجعة", "ملفات الأرشفة بقفل موافقة المدير"]}
    />
  );
}
