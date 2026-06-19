import type { Metadata } from "next";
import { AccountSecurity } from "@/components/dashboard/AccountSecurity";

export const metadata: Metadata = { title: "الإعدادات" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-fg">الإعدادات</h1>
        <p className="mt-1 text-sm text-mut">إدارة حسابك وأمانك وتفضيلات المنشأة.</p>
      </div>

      {/* الأمان وكلمة المرور — تغيير فوري بلا بريد */}
      <AccountSecurity />

      {/* تفضيلات المنشأة (قريباً) */}
      <div className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-lg font-bold text-fg">تفضيلات المنشأة</h2>
        <p className="mt-1 text-sm text-mut">اللغة والعملة والمنطقة الزمنية وبيانات المنشأة.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {["بيانات المنشأة", "اللغة والعملة", "المنطقة الزمنية", "التفضيلات العامة"].map((f) => (
            <div key={f} className="flex items-center gap-2 rounded-xl border border-line bg-card2/40 p-3 text-sm text-mut">
              <span className="text-gold">◆</span>
              {f}
              <span className="mr-auto rounded-full bg-card2 px-2 py-0.5 text-[11px]">قريباً</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
