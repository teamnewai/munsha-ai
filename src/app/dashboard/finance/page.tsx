import type { Metadata } from "next";
import { getFinance } from "@/lib/data";
import { fmtFromSAR } from "@/lib/money";
import { fmtNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "المالية" };

const BUCKET_AR: Record<string, string> = {
  current: "حالية", "0_30": "1–30 يوم", "31_60": "31–60 يوم", "60_plus": "أكثر من 60 يوم",
};
const BUCKET_TONE: Record<string, string> = {
  current: "bg-ok", "0_30": "bg-gold", "31_60": "bg-warn", "60_plus": "bg-bad",
};

export default async function FinancePage() {
  const f = await getFinance();
  const totalArrears = f.aging.reduce((s, a) => s + a.sum, 0);
  const maxBucket = Math.max(1, ...f.aging.map((a) => a.sum));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-fg">💰 المالية</h1>
        <p className="mt-1 text-sm text-mut">المحصّل والمستحق وأعمار المتأخرات (من فواتيرك ومدفوعاتك الحقيقية).</p>
      </div>

      <div className={`rounded-xl border p-3 text-xs ${f.isReal ? "border-ok/30 bg-ok/10 text-ok" : "border-gold/30 bg-gold/10 text-gold"}`}>
        {f.isReal ? "● بيانات مالية حقيقية من قاعدة بياناتك." : "وضع تجريبي: سجّل الدخول لعرض ماليتك الحقيقية."}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon="✅" label="إجمالي المحصّل" value={fmtFromSAR(f.collected)} tone="text-ok" />
        <Kpi icon="🧾" label="فواتير معلّقة" value={fmtFromSAR(f.pendingSum)} sub={`${fmtNumber(f.pendingCount)} فاتورة`} />
        <Kpi icon="⏰" label="متأخرات" value={fmtFromSAR(f.overdueSum || totalArrears)} sub={`${fmtNumber(f.overdueCount)} متأخرة`} tone="text-bad" />
        <Kpi icon="📊" label="إجمالي المدفوع (فواتير)" value={fmtFromSAR(f.paidSum)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* أعمار المتأخرات */}
        <section className="rounded-2xl border border-line bg-card p-6 lg:col-span-2">
          <h2 className="mb-5 text-sm font-bold text-fg">أعمار المتأخرات (Aging)</h2>
          <div className="space-y-4">
            {f.aging.map((a) => (
              <div key={a.bucket}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-mut">{BUCKET_AR[a.bucket] ?? a.bucket} · {fmtNumber(a.count)}</span>
                  <span className="font-bold text-fg">{fmtFromSAR(a.sum)}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-card2">
                  <div className={`h-full rounded-full ${BUCKET_TONE[a.bucket] ?? "bg-gold"}`} style={{ width: `${(a.sum / maxBucket) * 100}%` }} />
                </div>
              </div>
            ))}
            {totalArrears === 0 && <p className="text-sm text-mut">لا توجد متأخرات 🎉</p>}
          </div>
        </section>

        {/* آخر المدفوعات */}
        <section className="rounded-2xl border border-line bg-card p-6">
          <h2 className="mb-4 text-sm font-bold text-fg">آخر المدفوعات</h2>
          {f.recentPayments.length === 0 ? (
            <p className="text-sm text-mut">لا توجد مدفوعات بعد.</p>
          ) : (
            <ul className="space-y-2">
              {f.recentPayments.map((p, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl border border-line bg-card2 p-3">
                  <div>
                    <div className="text-sm font-bold text-ok">{fmtFromSAR(Number(p.amount) || 0)}</div>
                    <div className="text-xs text-mut">{p.method ?? "—"}</div>
                  </div>
                  <span className="text-xs text-mut">{p.paid_on ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-mut">ملاحظة: مبدأ REOS — المنصة تُسجّل المعاملات ولا تحوز الأموال. الضريبة 15% تُحتسب على الفواتير.</p>
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <span className="text-xl">{icon}</span>
      <div className={`mt-3 text-xl font-extrabold ${tone ?? "text-fg"}`}>{value}</div>
      <div className="mt-1 text-xs text-mut">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-mut">{sub}</div>}
    </div>
  );
}
