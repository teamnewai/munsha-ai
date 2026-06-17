import type { Metadata } from "next";
import Link from "next/link";
import { fmtNumber, fmtDate } from "@/lib/utils";
import { fmtFromSAR } from "@/lib/money";

export const metadata: Metadata = { title: "لوحة التحكم" };

// بيانات تجريبية للعرض — تُستبدل ببيانات Supabase بعد الربط (getDashboardData).
const KPIS = [
  { label: "إجمالي الوحدات", value: 42, icon: "🚪", tone: "brand" },
  { label: "العقود النشطة", value: 31, icon: "📄", tone: "green" },
  { label: "فواتير معلّقة", value: 7, icon: "🧾", tone: "amber" },
  { label: "صيانة مفتوحة", value: 4, icon: "🔧", tone: "rose" },
];

const REPORTS = [
  { label: "تقرير المتأخرات", href: "/dashboard/reports", icon: "📉" },
  { label: "تقرير الصيانة", href: "/dashboard/reports", icon: "🔧" },
  { label: "انتهاء العقود", href: "/dashboard/reports", icon: "⏰" },
  { label: "إشغال الوحدات", href: "/dashboard/reports", icon: "🏢" },
];

const toneClass: Record<string, string> = {
  brand: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-slate-500">{fmtDate(new Date())}</p>
        </div>
        <Link
          href="/os"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-900"
        >
          👑 ادخل نظام التشغيل
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${toneClass[k.tone]}`}>
                {k.icon}
              </span>
            </div>
            <div className="mt-4 text-3xl font-extrabold text-slate-900">{fmtNumber(k.value)}</div>
            <div className="mt-1 text-sm text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* الصف الأوسط */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* صافي الدخل */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-bold text-slate-500">صافي الدخل (هذا الشهر)</h3>
          <div className="mt-3 text-3xl font-extrabold text-emerald-600">
            {fmtFromSAR(128400)}
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="الإيرادات" value={fmtFromSAR(186000)} tone="text-emerald-600" />
            <Row label="المصروفات" value={fmtFromSAR(57600)} tone="text-rose-600" />
          </div>
        </div>

        {/* قرارات بانتظار الموافقة */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold text-slate-500">قرارات بانتظار موافقتك</h3>
          <ul className="space-y-3">
            {[
              { t: "موافقة على صيانة كهرباء — برج العليا", amt: 2400, lvl: "مالك" },
              { t: "تجديد عقد — وحدة A-204", amt: 36000, lvl: "مدير" },
              { t: "اعتماد عرض مزود خدمة — تكييف", amt: 1850, lvl: "مدير" },
            ].map((d) => (
              <li
                key={d.t}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{d.t}</p>
                  <p className="text-xs text-slate-500">
                    {fmtFromSAR(d.amt)} • مستوى الموافقة: {d.lvl}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                    موافقة
                  </button>
                  <button className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
                    رفض
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* اختصارات التقارير */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-500">تقارير سريعة</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REPORTS.map((r) => (
            <Link
              key={r.label}
              href={r.href}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-lg">
                {r.icon}
              </span>
              <span className="text-sm font-medium text-slate-700">{r.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${tone}`}>{value}</span>
    </div>
  );
}
