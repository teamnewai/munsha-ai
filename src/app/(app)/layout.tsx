import { AppSidebar } from "@/components/os-app/AppSidebar";
import { TopBar } from "@/components/os-app/TopBar";
import { ImpersonationBanner } from "@/components/os-app/ImpersonationBanner";

// مُلكي OS — قشرة مساحة العمل (شريط جانبي + علوي) لصفحات Lovable المنقولة
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ImpersonationBanner />
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
