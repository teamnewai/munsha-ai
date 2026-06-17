import type { ReactNode } from "react";

export interface Column {
  key: string;
  label: string;
}

/** قائمة كيانات موحّدة (جدول) مع شارة مصدر البيانات وحالة فارغة. */
export function EntityList({
  icon,
  title,
  description,
  isReal,
  columns,
  rows,
  addLabel,
}: {
  icon: string;
  title: string;
  description: string;
  isReal: boolean;
  columns: Column[];
  rows: Record<string, ReactNode>[];
  addLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <span>{icon}</span>
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {addLabel && (
          <button className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
            + {addLabel}
          </button>
        )}
      </div>

      <div
        className={`rounded-xl border p-3 text-xs ${
          isReal
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        {isReal
          ? "● بيانات حقيقية من قاعدة بياناتك."
          : "وضع تجريبي: سجّل الدخول بعد ربط Supabase لعرض بياناتك الحقيقية."}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            لا توجد سجلات بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-right text-slate-500">
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-3 font-bold">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-slate-700">
                        {r[c.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** شارة حالة ملوّنة */
export function StatusBadge({ children, tone }: { children: ReactNode; tone: "green" | "amber" | "rose" | "slate" | "brand" }) {
  const map = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
    brand: "bg-brand-50 text-brand-700",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[tone]}`}>{children}</span>;
}
