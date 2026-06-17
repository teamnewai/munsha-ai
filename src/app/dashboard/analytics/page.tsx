import type { Metadata } from "next";
import { getAnalytics } from "@/lib/data";

export const metadata: Metadata = { title: "التحليلات" };

const sar = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n) + " ر.س";

export default async function Page() {
  const a = await getAnalytics();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-fg">📈 التحليلات</h1>
        <p className="mt-1 text-sm text-mut">مؤشرات الإشغال والإيرادات والتشغيل — محسوبة مباشرة من بياناتك.</p>
      </div>

      <div className={`rounded-xl border p-3 text-xs ${a.isReal ? "border-ok/30 bg-ok/10 text-ok" : "border-gold/30 bg-gold/10 text-gold"}`}>
        {a.isReal ? "● مؤشرات حقيقية من قاعدة بياناتك." : "وضع تجريبي: سجّل الدخول لعرض مؤشراتك الحقيقية."}
      </div>

      {/* بطاقات رئيسية */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="نسبة الإشغال" value={`${a.occupancyRate}%`} sub={`${a.unitsOccupied} من ${a.unitsTotal} وحدة`} tone="brand" />
        <Kpi label="المُحصَّل" value={sar(a.collected)} sub="إجمالي المدفوعات" tone="ok" />
        <Kpi label="مستحقات قائمة" value={sar(a.pendingSum)} sub={`${a.pendingCount} فاتورة · ${a.overdueCount} متأخرة`} tone="amber" />
        <Kpi label="عقود نشطة" value={`${a.contractsActive}`} sub={`من ${a.contractsTotal} عقد`} tone="brand" />
      </div>

      {/* الإشغال — شريط */}
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-3 text-sm font-bold text-fg">الإشغال</h2>
        <div className="h-4 w-full overflow-hidden rounded-full bg-card2">
          <div className="h-full rounded-full bg-gold" style={{ width: `${a.occupancyRate}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-mut">
          <span>مشغولة: {a.unitsOccupied}</span>
          <span>شاغرة: {Math.max(0, a.unitsTotal - a.unitsOccupied)}</span>
        </div>
      </section>

      {/* مؤشرات تشغيلية */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Mini label="صيانة مفتوحة" value={a.maintOpen} icon="🔧" />
        <Mini label="صيانة منجزة" value={a.maintDone} icon="✅" />
        <Mini label="حجم الفريق" value={a.teamSize} icon="👥" />
        <Mini label="ملاحظات مفتوحة" value={a.feedbackOpen} icon="🗒️" />
      </div>

      {a.errorsOpen > 0 && (
        <div className="rounded-2xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">
          ⚠️ {a.errorsOpen} خطأ تقني مفتوح سُجّل تلقائياً — راجعه في «سجل التدقيق».
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "brand" | "ok" | "amber" }) {
  const ring = { brand: "border-gold/30", ok: "border-ok/30", amber: "border-gold/30" }[tone];
  return (
    <div className={`rounded-2xl border ${ring} bg-card p-5`}>
      <div className="text-xs font-medium text-mut">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-fg">{value}</div>
      <div className="mt-1 text-xs text-mut">{sub}</div>
    </div>
  );
}

function Mini({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-card2 text-lg">{icon}</span>
      <div>
        <div className="text-xl font-extrabold text-fg">{value}</div>
        <div className="text-xs text-mut">{label}</div>
      </div>
    </div>
  );
}
