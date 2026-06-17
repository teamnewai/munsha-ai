import type { Metadata } from "next";
import { OsPlaceholder } from "@/components/os/OsPlaceholder";

export const metadata: Metadata = { title: "غرفة العمليات — MULKI OS" };

export default function Page() {
  return (
    <OsPlaceholder
      icon="🛰️"
      title="غرفة العمليات"
      description="مركز القيادة: مؤشرات لحظية، أداء الأقسام، حضور الفريق، ومركز تحكم الذكاء الاصطناعي."
      features={["مؤشرات لحظية", "أداء الأقسام (رسوم بيانية)", "مقياس حضور الفريق", "مركز تحكم قوة العمل الذكية"]}
    />
  );
}
