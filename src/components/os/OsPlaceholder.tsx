import Link from "next/link";

/** بطاقة "قيد الإنشاء" بهوية نظام التشغيل الداكنة/الذهبية */
export function OsPlaceholder({
  icon,
  title,
  description,
  features,
  badge = "قيد التفعيل",
}: {
  icon: string;
  title: string;
  description: string;
  features: string[];
  badge?: string;
}) {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <header className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/os" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500 font-extrabold text-brand-950">
              👑
            </span>
            <span className="text-sm font-extrabold">MULKI OS</span>
          </Link>
          <Link
            href="/os"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
          >
            ← البوابات
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-white/10 bg-white/5 text-4xl">
          {icon}
        </div>
        <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-slate-300">{description}</p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold-500/15 px-4 py-1.5 text-xs font-bold text-gold-300">
          🚧 {badge}
        </span>

        <div className="mt-10 grid gap-3 text-right sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f}
              className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200"
            >
              <span className="mt-0.5 text-gold-400">◆</span>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
