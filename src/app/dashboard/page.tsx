import type { Metadata } from "next";
import Link from "next/link";
import { fmtNumber, fmtDate } from "@/lib/utils";
import { fmtFromSAR } from "@/lib/money";

export const metadata: Metadata = { title: "مكتب المالك" };

/* ============================================================
   مكتب المالك (CEO Cockpit) — مرجع: وثيقة «الشجرة» §298-322
   بيانات عرض؛ في النسخة الحيّة كل رقمٍ يُحسب من جداول النواة
   (المصدر مذكورٌ تحت كل مؤشّر — مبدأ «قطرة الماء»).
   ============================================================ */

const KPIS = [
  { label: "إجمالي الإيرادات", value: fmtFromSAR(2458000), delta: "+15.6%", up: true, icon: "📈", src: "invoices · payments" },
  { label: "إجمالي المصروفات", value: fmtFromSAR(1125000), delta: "+8.3%", up: false, icon: "📉", src: "payments" },
  { label: "إجمالي الأرباح", value: fmtFromSAR(1333000), delta: "+21.4%", up: true, icon: "💰", src: "محسوبة" },
  { label: "المهام المكتملة", value: "85%", delta: "+10%", up: true, icon: "✅", src: "tasks" },
  { label: "الموظفون المتواجدون", value: "128 / 156", delta: "", up: true, icon: "👥", src: "attendance" },
  { label: "المهام المتأخرة", value: fmtNumber(23), delta: "-4", up: true, icon: "⏰", src: "tasks (متأخرة)" },
];

const DEPTS = [
  { name: "المالية", icon: "💰", emp: 14, open: 9, done: 41, perf: 92 },
  { name: "المبيعات", icon: "📈", emp: 22, open: 17, done: 63, perf: 78 },
  { name: "الصيانة", icon: "🔧", emp: 18, open: 12, done: 54, perf: 64 },
  { name: "العمليات", icon: "⚙️", emp: 16, open: 7, done: 38, perf: 85 },
  { name: "خدمة العملاء", icon: "🎧", emp: 11, open: 5, done: 49, perf: 71 },
];

const PRESENT = [
  { n: "أحمد العتيبي", t: "07:58", dept: "المالية" },
  { n: "سارة القحطاني", t: "08:03", dept: "المبيعات" },
  { n: "محمد الزهراني", t: "08:12", dept: "العمليات" },
];
const ABSENT = [{ n: "خالد الدوسري", dept: "الصيانة" }, { n: "نورة الشمري", dept: "خدمة العملاء" }];

const DECISIONS = [
  { t: "اعتماد صيانة كهرباء — برج العليا", amt: 2400, lvl: "مالك" },
  { t: "تجديد عقد — وحدة A-204", amt: 36000, lvl: "مدير" },
  { t: "اعتماد عرض مزوّد — تكييف", amt: 1850, lvl: "مدير" },
];

const ACTIVITIES = [
  { icon: "🧾", t: "فاتورة جديدة #INV-2041 بقيمة 18,000 ر.س", time: "قبل 5 د" },
  { icon: "🔧", t: "طلب صيانة جديد — وحدة B-110", time: "قبل 22 د" },
  { icon: "📄", t: "توقيع عقد إيجار — وحدة C-309", time: "قبل ساعة" },
  { icon: "👤", t: "انضمام عضو فريق — قسم المبيعات", time: "قبل 3 س" },
];

const REPORTS = [
  { label: "المتأخرات", icon: "📉" },
  { label: "الإشغال", icon: "🏢" },
  { label: "انتهاء العقود", icon: "⏰" },
  { label: "أداء الصيانة", icon: "🔧" },
];

const COMMS = [
  { icon: "🎙️", label: "صوتي" },
  { icon: "🎥", label: "فيديو" },
  { icon: "🖥️", label: "مشاركة شاشة" },
  { icon: "📡", label: "بث مباشر" },
  { icon: "💬", label: "رسالة" },
  { icon: "📎", label: "ملف" },
];

export default function OwnerCockpit() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      {/* الترويسة */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">مكتب المالك</h1>
          <p className="mt-1 text-sm text-slate-500">{fmtDate(new Date())} · نظرة شاملة على أداء المنشأة</p>
        </div>
        <Link
          href="/os"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-900"
        >
          👑 ادخل نظام التشغيل
        </Link>
      </div>

      {/* مؤشّرات الأداء (6) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xl">{k.icon}</span>
              {k.delta && (
                <span className={`text-xs font-bold ${k.up ? "text-emerald-600" : "text-rose-600"}`}>
                  {k.delta}
                </span>
              )}
            </div>
            <div className="mt-3 text-xl font-extrabold text-slate-900">{k.value}</div>
            <div className="mt-1 text-xs text-slate-500">{k.label}</div>
            <div className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
              المصدر: {k.src}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* العمود الرئيسي */}
        <div className="space-y-6 lg:col-span-2">
          {/* أداء الإدارات */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">أداء الإدارات</h2>
              <Link href="/os/structure" className="text-xs font-bold text-brand-700 hover:underline">
                الهيكل الكامل ←
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {DEPTS.map((d) => (
                <div key={d.name} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-bold text-slate-800">
                      <span>{d.icon}</span>
                      {d.name}
                    </span>
                    <span className="text-xs text-slate-500">{d.emp} موظف</span>
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-slate-500">
                    <span>مفتوحة: <b className="text-slate-700">{d.open}</b></span>
                    <span>مكتملة: <b className="text-slate-700">{d.done}</b></span>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-400">الأداء</span>
                      <span className="font-bold text-slate-700">{d.perf}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${d.perf >= 80 ? "bg-emerald-500" : d.perf >= 70 ? "bg-brand-500" : "bg-amber-500"}`}
                        style={{ width: `${d.perf}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* آخر الأنشطة */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-bold text-slate-700">آخر الأنشطة</h2>
            <ul className="space-y-3">
              {ACTIVITIES.map((a) => (
                <li key={a.t} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-base">
                    {a.icon}
                  </span>
                  <span className="flex-1 text-sm text-slate-700">{a.t}</span>
                  <span className="text-xs text-slate-400">{a.time}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* العمود الجانبي */}
        <div className="space-y-6">
          {/* صافي الدخل */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-bold text-slate-500">صافي الدخل (هذا الشهر)</h2>
            <div className="mt-2 text-3xl font-extrabold text-emerald-600">{fmtFromSAR(1333000)}</div>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="الإيرادات" value={fmtFromSAR(2458000)} tone="text-emerald-600" />
              <Row label="المصروفات" value={fmtFromSAR(1125000)} tone="text-rose-600" />
            </div>
          </section>

          {/* الحضور */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-bold text-slate-700">الحضور اليوم</h2>
            <div className="space-y-2">
              {PRESENT.map((p) => (
                <div key={p.n} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {p.n}
                  </span>
                  <span className="text-xs text-slate-400">{p.t}</span>
                </div>
              ))}
              {ABSENT.map((p) => (
                <div key={p.n} className="flex items-center justify-between text-sm text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    {p.n}
                  </span>
                  <span className="text-xs">غائب</span>
                </div>
              ))}
            </div>
          </section>

          {/* قرارات بانتظار الموافقة */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-bold text-slate-700">قرارات بانتظار موافقتك</h2>
            <ul className="space-y-2">
              {DECISIONS.map((d) => (
                <li key={d.t} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-800">{d.t}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{fmtFromSAR(d.amt)} · {d.lvl}</span>
                    <div className="flex gap-1.5">
                      <button className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700">
                        موافقة
                      </button>
                      <button className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
                        رفض
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* تقارير ذكية */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-bold text-slate-700">تقارير ذكية</h2>
            <div className="grid grid-cols-2 gap-2">
              {REPORTS.map((r) => (
                <Link
                  key={r.label}
                  href="/dashboard/reports"
                  className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <span>{r.icon}</span>
                  {r.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* شريط التواصل السفلي */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur lg:pr-64">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 sm:gap-3">
          {COMMS.map((c) => (
            <button
              key={c.label}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              <span className="text-base">{c.icon}</span>
              <span className="hidden sm:inline">{c.label}</span>
            </button>
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
