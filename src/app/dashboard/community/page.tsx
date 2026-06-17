import type { Metadata } from "next";
import { getCommunityData } from "@/lib/data";
import { fmtFromSAR } from "@/lib/money";
import { fmtNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "اتحاد الملاك" };

export default async function CommunityPage() {
  const c = await getCommunityData();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-fg">🏘️ اتحاد الملاك (HOA)</h1>
        <p className="mt-1 text-sm text-mut">إدارة الاتحادات والرسوم — التصويت وحجز المرافق (قادمة).</p>
      </div>

      <div className={`rounded-xl border p-3 text-xs ${c.isReal ? "border-ok/30 bg-ok/10 text-ok" : "border-gold/30 bg-gold/10 text-gold"}`}>
        {c.isReal ? "● بيانات اتحاد الملاك الحقيقية من قاعدة بياناتك." : "وضع تجريبي: سجّل الدخول لعرض بياناتك الحقيقية."}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon="🏘️" label="عدد الاتحادات" value={fmtNumber(c.communities.length)} />
        <Kpi icon="✅" label="رسوم محصّلة" value={fmtFromSAR(c.feesCollected)} tone="text-ok" />
        <Kpi icon="⏰" label="رسوم مستحقة" value={fmtFromSAR(c.feesOutstanding)} tone="text-bad" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="border-b border-line p-4 text-sm font-bold text-fg">الاتحادات</div>
        {c.communities.length === 0 ? (
          <div className="p-12 text-center text-sm text-mut">لا توجد اتحادات بعد.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-card2 text-right text-mut">
              <th className="px-4 py-3 font-bold">الاتحاد</th>
              <th className="px-4 py-3 font-bold">عدد الرسوم</th>
            </tr></thead>
            <tbody>
              {c.communities.map((x) => (
                <tr key={x.name} className="border-b border-line last:border-0 hover:bg-card2">
                  <td className="px-4 py-3 font-medium text-fg">🏘️ {x.name}</td>
                  <td className="px-4 py-3 text-mut">{fmtNumber(x.units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: "🗳️", t: "التصويت على القرارات", d: "قرارات الاتحاد بصوت واحد لكل مالك" },
          { icon: "🏊", t: "حجز المرافق", d: "حجز المرافق المشتركة" },
          { icon: "📋", t: "محاضر الاجتماعات", d: "توثيق اجتماعات المجلس" },
        ].map((f) => (
          <div key={f.t} className="rounded-2xl border border-line bg-card p-5">
            <div className="text-2xl">{f.icon}</div>
            <div className="mt-2 font-bold text-fg">{f.t}</div>
            <p className="mt-1 text-xs text-mut">{f.d}</p>
            <span className="mt-3 inline-block rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-bold text-gold">قيد الإنشاء</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <span className="text-xl">{icon}</span>
      <div className={`mt-3 text-xl font-extrabold ${tone ?? "text-fg"}`}>{value}</div>
      <div className="mt-1 text-xs text-mut">{label}</div>
    </div>
  );
}
