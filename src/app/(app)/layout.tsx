import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/os-app/AppSidebar";
import { TopBar } from "@/components/os-app/TopBar";
import { ImpersonationBanner } from "@/components/os-app/ImpersonationBanner";
import { GlobalCallBanner } from "@/components/GlobalCallBanner";

// مُلكي OS — قشرة مساحة العمل (شريط جانبي + علوي) لصفحات Lovable المنقولة
// حارس أمني: كل صفحات مجموعة (app) تتطلب جلسة مسجّلة الدخول (دفاع متعمّق
// إلى جانب تقييد كل إجراء بـ org_id). عند غياب مفاتيح Supabase (وضع تجريبي) يُسمح بالمرور.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  if (sb) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) redirect("/login");
  }
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ImpersonationBanner />
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      <GlobalCallBanner />
    </div>
  );
}
