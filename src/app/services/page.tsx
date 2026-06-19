import { Suspense } from "react";
import { ServicesClient } from "./ServicesClient";

export const metadata = { title: "سوق الخدمات — توجيه ذكي للمنشآت | مُلكي" };

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-foreground">جارٍ التحميل…</div>}>
      <ServicesClient />
    </Suspense>
  );
}
