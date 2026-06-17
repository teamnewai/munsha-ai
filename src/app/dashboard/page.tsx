import type { Metadata } from "next";
import Link from "next/link";
import { fmtNumber, fmtDate } from "@/lib/utils";
import { fmtFromSAR } from "@/lib/money";
import { getDashboardData } from "@/lib/data";
import { SeedDemoButton } from "@/components/dashboard/SeedDemoButton";

export const metadata: Metadata = { title: "مكتب المالك" };

/* مكتب المالك (CEO Cockpit) — مرجع: وثيقة «الشجرة» §298-322
   يقرأ بيانات منشأتك الحقيقية عند تسجيل الدخول؛ وإلا وضع تجريبي. */

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

export default async function OwnerCockpit() {
  const data = await getDashboardData();

  const presentCount = data.presence.filter((p) => p.present).length;
  const avgPerf = data.departments.length
    ? Math.round(data.departments.reduce((s, d) => s + d.perf, 0) / data.departments.length)
    : 0;

  const KPIS = [
    { label: "إجمالي الوحدات", value: fmtNumber(data.unitsTotal), icon: "🚪", src: "units" },
    { label: "العقود النشطة", value: fmtNumber(data.contractsActive), icon: "📄", src: "contracts" },
    { label: "فواتير معلّقة", value: fmtNumber(data.invoicesPending), icon: "🧾", src: "invoices" },
    { label: "الإدارات", value: fmtNumber(data.departments.length), icon: "🏛️", src: "org_departments" },
    { label: "المتواجدون", value: `${presentCount} / ${data.presence.length}`, icon: "👥", src: "dept_members" },
    { label: "متوسط الأداء", value: `${avgPerf}%`, icon: "📊", src: "محسوبة" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      {/* الترويسة */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-fg">
            مكتب المالك{data.orgName ? ` — ${data.orgName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-mut">{fmtDate(new Date())} · نظرة شاملة على أداء المنشأة</p>
        </div>
        <Link
          href="/os"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-900"
        >
          👑 ادخل نظام التشغيل
        </Link>
      </div>

      {/* شارة مصدر البيانات */}
      <div
        className={`rounded-xl border p-3 text-xs ${
          data.isReal
            ? "border-ok/30 bg-ok/10 text-ok"
            : "border-gold/30 bg-gold/10 text-gold"
        }`}
      >
        {data.isReal
          ? "● متصل ببياناتك الحقيقية من Supabase (mulki-reos)."
          : "وضع تجريبي: سجّل الدخول بحسابك بعد ربط مفاتيح Supabase لعرض بياناتك الحقيقية."}
      </div>

      {/* بداية سريعة — يظهر فقط حين تكون المنشأة فارغة */}
      <SeedDemoButton />

      {/* مؤشّرات الأداء (6) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-card p-4">
            <span className="text-xl">{k.icon}</span>
            <div className="mt-3 text-xl font-extrabold text-fg">{k.value}</div>
            <div className="mt-1 text-xs text-mut">{k.label}</div>
            <div className="mt-2 border-t border-line pt-1.5 text-[10px] text-mut">المصدر: {k.src}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* العمود الرئيسي */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-line bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-fg">أداء الإدارات</h2>
              <Link href="/os/structure" className="text-xs font-bold text-gold hover:underline">
                الهيكل الكامل ←
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.departments.map((d) => (
                <div key={d.name} className="rounded-xl border border-line bg-card2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-bold text-fg">
                      <span>{d.icon}</span>
                      {d.name}
                    </span>
                    <span className="text-xs text-mut">{d.emp} موظف</span>
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-mut">
                    <span>مفتوحة: <b className="text-fg">{d.open}</b></span>
                    <span>مكتملة: <b className="text-fg">{d.done}</b></span>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-mut">الأداء</span>
                      <span className="font-bold text-fg">{d.perf}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-card2">
                      <div
                        className={`h-full rounded-full ${d.perf >= 80 ? "bg-emerald-500" : d.perf >= 70 ? "bg-gold" : "bg-amber-500"}`}
                        style={{ width: `${d.perf}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-card p-6">
            <h2 className="mb-4 text-sm font-bold text-fg">آخر الأنشطة</h2>
            <ul className="space-y-3">
              {ACTIVITIES.map((a) => (
                <li key={a.t} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/10 text-base">
                    {a.icon}
                  </span>
                  <span className="flex-1 text-sm text-fg">{a.t}</span>
                  <span className="text-xs text-mut">{a.time}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* العمود الجانبي */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-card p-6">
            <h2 className="text-sm font-bold text-mut">صافي الدخل (هذا الشهر)</h2>
            <div className="mt-2 text-3xl font-extrabold text-ok">{fmtFromSAR(1333000)}</div>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="الإيرادات" value={fmtFromSAR(2458000)} tone="text-ok" />
              <Row label="المصروفات" value={fmtFromSAR(1125000)} tone="text-bad" />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-card p-6">
            <h2 className="mb-3 text-sm font-bold text-fg">الحضور اليوم</h2>
            <div className="space-y-2">
              {data.presence.map((p) => (
                <div
                  key={p.name}
                  className={`flex items-center justify-between text-sm ${p.present ? "" : "text-mut"}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.present ? "bg-emerald-500" : "bg-card2"}`} />
                    {p.name}
                  </span>
                  <span className="text-xs">{p.present ? "متواجد" : "غائب"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-card p-6">
            <h2 className="mb-3 text-sm font-bold text-fg">قرارات بانتظار موافقتك</h2>
            <ul className="space-y-2">
              {DECISIONS.map((d) => (
                <li key={d.t} className="rounded-xl border border-line bg-card2 p-3">
                  <p className="text-sm font-medium text-fg">{d.t}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-mut">{fmtFromSAR(d.amt)} · {d.lvl}</span>
                    <div className="flex gap-1.5">
                      <button className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700">
                        موافقة
                      </button>
                      <button className="rounded-lg bg-card px-2.5 py-1 text-xs font-bold text-mut ring-1 ring-line hover:bg-card2">
                        رفض
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-card p-6">
            <h2 className="mb-3 text-sm font-bold text-fg">تقارير ذكية</h2>
            <div className="grid grid-cols-2 gap-2">
              {REPORTS.map((r) => (
                <Link
                  key={r.label}
                  href="/dashboard/reports"
                  className="flex items-center gap-2 rounded-xl border border-line bg-card2 p-3 text-sm text-fg hover:bg-card2"
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/90 backdrop-blur lg:pr-64">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 sm:gap-3">
          {COMMS.map((c) => (
            <button
              key={c.label}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-mut hover:bg-card2"
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
      <span className="text-mut">{label}</span>
      <span className={`font-bold ${tone}`}>{value}</span>
    </div>
  );
}
