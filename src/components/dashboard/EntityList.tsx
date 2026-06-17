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
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-fg">
            <span>{icon}</span>
            {title}
          </h1>
          <p className="mt-1 text-sm text-mut">{description}</p>
        </div>
        {addLabel && (
          <button className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90">
            + {addLabel}
          </button>
        )}
      </div>

      <div
        className={`rounded-xl border p-3 text-xs ${
          isReal
            ? "border-ok/30 bg-ok/10 text-ok"
            : "border-gold/30 bg-gold/10 text-gold"
        }`}
      >
        {isReal
          ? "● بيانات حقيقية من قاعدة بياناتك."
          : "وضع تجريبي: سجّل الدخول بعد ربط Supabase لعرض بياناتك الحقيقية."}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-mut">
            لا توجد سجلات بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-card2 text-right text-mut">
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-3 font-bold">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0 hover:bg-card2">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-fg">
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
    green: "bg-ok/15 text-ok",
    amber: "bg-gold/15 text-gold",
    rose: "bg-bad/15 text-bad",
    slate: "bg-card2 text-mut",
    brand: "bg-gold/10 text-gold",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[tone]}`}>{children}</span>;
}
