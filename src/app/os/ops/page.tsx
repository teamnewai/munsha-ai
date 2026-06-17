import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "غرفة العمليات — MULKI OS" };

// غرفة العمليات — مرجع: Blueprint §2.10 (بمؤشّرات عرض؛ تُربط بالنواة لاحقاً)
const KPIS = [
  { label: "الإيرادات (شهري)", value: "186K", delta: "+15.6%", up: true },
  { label: "المصروفات", value: "57.6K", delta: "+8.3%", up: false },
  { label: "أوامر السوق", value: "34", delta: "+12", up: true },
  { label: "صيانة مفتوحة", value: "4", delta: "-2", up: true },
];

const DEPT_PERF = [
  { name: "المالية", value: 92 },
  { name: "المبيعات", value: 78 },
  { name: "الصيانة", value: 64 },
  { name: "العمليات", value: 85 },
  { name: "خدمة العملاء", value: 71 },
];

const AI_STATUS = [
  { name: "نور (السكرتيرة)", state: "نشط", tone: "emerald" },
  { name: "CFO AI", state: "قيد التفعيل", tone: "amber" },
  { name: "Operations AI", state: "قيد التفعيل", tone: "amber" },
  { name: "Legal AI", state: "متوقف", tone: "slate" },
];

const SPARK = [40, 55, 48, 62, 70, 65, 80, 78, 92];

export default function OpsPage() {
  return (
    <div className="min-h-screen bg-[#070b16] text-slate-100">
      <header className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/os" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 font-extrabold text-brand-950">
              🛰️
            </span>
            <span className="text-sm font-extrabold">غرفة العمليات</span>
          </Link>
          <span className="flex items-center gap-2 text-xs text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> مباشر
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((k) => (
            <div key={k.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-400">{k.label}</div>
              <div className="mt-2 text-3xl font-extrabold">{k.value}</div>
              <div className={`mt-1 text-xs font-bold ${k.up ? "text-emerald-400" : "text-rose-400"}`}>
                {k.delta}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* أداء الأقسام */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
            <h3 className="mb-5 text-sm font-bold text-slate-300">أداء الأقسام</h3>
            <div className="space-y-4">
              {DEPT_PERF.map((d) => (
                <div key={d.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-300">{d.name}</span>
                    <span className="font-bold text-slate-200">{d.value}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/30">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-600"
                      style={{ width: `${d.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Sparkline اتجاه الإيراد */}
            <div className="mt-8">
              <div className="mb-2 text-sm font-bold text-slate-300">اتجاه الإيراد (9 أسابيع)</div>
              <svg viewBox="0 0 180 50" className="h-16 w-full">
                <polyline
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2"
                  points={SPARK.map((v, i) => `${(i / (SPARK.length - 1)) * 180},${50 - (v / 100) * 50}`).join(" ")}
                />
              </svg>
            </div>
          </div>

          {/* مقياس الحضور + مركز تحكم AI */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
              <h3 className="mb-4 text-sm font-bold text-slate-300">حضور الفريق</h3>
              <Gauge value={82} />
              <p className="mt-2 text-sm text-slate-400">128 من 156 متواجد</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-4 text-sm font-bold text-slate-300">مركز تحكم الذكاء</h3>
              <ul className="space-y-2">
                {AI_STATUS.map((a) => (
                  <li key={a.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{a.name}</span>
                    <Dot tone={a.tone} label={a.state} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 52;
  const c = Math.PI * r; // نصف دائرة
  const offset = c - (value / 100) * c;
  return (
    <svg viewBox="0 0 140 80" className="mx-auto h-24 w-40">
      <path d="M 14 78 A 56 56 0 0 1 126 78" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
      <path
        d="M 14 78 A 56 56 0 0 1 126 78"
        fill="none"
        stroke="#34d399"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
      <text x="70" y="72" textAnchor="middle" className="fill-white text-2xl font-extrabold">
        {value}%
      </text>
    </svg>
  );
}

function Dot({ tone, label }: { tone: string; label: string }) {
  const map: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    slate: "bg-slate-500/15 text-slate-300",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[tone]}`}>{label}</span>;
}
