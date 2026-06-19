import type { Metadata } from "next";
import Link from "next/link";
import { DEPARTMENTS } from "@/lib/deptMeta";
import { OsLive } from "@/components/os/OsLive";

export const metadata: Metadata = { title: "نظام التشغيل — MULKI OS" };

const GATES = [
  {
    href: "/os/desk",
    title: "المكتب الافتراضي",
    desc: "مكتب الموظف وأدواته اليومية",
    icon: "🪑",
    grad: "from-blue-500/20 to-blue-700/10",
  },
  {
    href: "/os/ops",
    title: "غرفة العمليات",
    desc: "مؤشرات لحظية ومركز تحكم AI",
    icon: "🛰️",
    grad: "from-emerald-500/20 to-emerald-700/10",
  },
  {
    href: "/os/control",
    title: "قاعة الاجتماعات",
    desc: "اجتماعات ذكية ومحاضر تلقائية",
    icon: "🎥",
    grad: "from-amber-500/20 to-amber-700/10",
  },
];

const ALERTS = [
  { t: "عقد ينتهي خلال 7 أيام — وحدة B-110", lvl: "تنبيه" },
  { t: "فاتورة متأخرة 31 يوماً — مستأجر #204", lvl: "هام" },
  { t: "طلب صيانة تجاوز SLA — تكييف برج العليا", lvl: "حرج" },
];

export default function OsPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      {/* الترويسة */}
      <header className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500 font-extrabold text-brand-950">
              👑
            </span>
            <div>
              <div className="text-sm font-extrabold">MULKI OS</div>
              <div className="text-xs text-slate-400">نظام تشغيل الأعمال</div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
          >
            ← لوحة التحكم
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* المكاتب الافتراضية والمؤشرات الحقيقية (مولّدة من هيكل منشأتك) */}
        <OsLive />

        {/* البوابات الثلاث */}
        <h2 className="mt-10 mb-4 text-lg font-bold">البوابات</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          {GATES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className={`group rounded-3xl border border-white/10 bg-gradient-to-br ${g.grad} p-6 transition-transform hover:-translate-y-1`}
            >
              <div className="text-4xl">{g.icon}</div>
              <h3 className="mt-4 text-xl font-bold">{g.title}</h3>
              <p className="mt-1 text-sm text-slate-300">{g.desc}</p>
              <span className="mt-4 inline-block text-sm font-bold text-gold-400 group-hover:underline">
                ادخل ←
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {/* التنبيهات */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
            <h3 className="mb-4 text-sm font-bold text-slate-300">التنبيهات والإشعارات</h3>
            <ul className="space-y-3">
              {ALERTS.map((a) => (
                <li
                  key={a.t}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <span className="text-sm text-slate-200">{a.t}</span>
                  <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                    {a.lvl}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* الأقسام */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-4 text-sm font-bold text-slate-300">الأقسام</h3>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.slice(0, 10).map((d) => (
                <span
                  key={d.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200"
                >
                  <span>{d.icon}</span>
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
