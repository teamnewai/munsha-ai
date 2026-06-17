import Link from "next/link";

export function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-extrabold text-white">
            مُ
          </span>
          <span className="text-lg font-extrabold text-brand-900">مُلكي</span>
        </Link>
      </div>

      <div className="hidden text-sm text-slate-500 lg:block">
        مرحباً بك في مساحة عملك
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
          aria-label="الإشعارات"
        >
          🔔
        </button>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pr-1 pl-3">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
            م
          </div>
          <span className="text-sm font-medium text-slate-700">حسابي</span>
        </div>
      </div>
    </header>
  );
}
