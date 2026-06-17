"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { PLANS, getPlan, fmtLimit, isUnlimited, type Plan } from "@/lib/plans";

export default function BillingPage() {
  const [plan, setPlan] = useState<Plan>(PLANS[0]);
  const [usage, setUsage] = useState({ users: 0, properties: 0 });
  const [isReal, setIsReal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) { setLoading(false); return; }
      const supabase = createClient()!;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!m?.org_id) { setLoading(false); return; }
      const [{ data: sub }, users, props] = await Promise.all([
        supabase.from("subscriptions").select("current_tier").eq("org_id", m.org_id).maybeSingle(),
        supabase.from("dept_members").select("id", { count: "exact", head: true }).eq("org_id", m.org_id),
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("org_id", m.org_id),
      ]);
      setPlan(getPlan((sub as { current_tier: string } | null)?.current_tier));
      setUsage({ users: users.count ?? 0, properties: props.count ?? 0 });
      setIsReal(true);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-fg">💳 الاشتراك والفوترة</h1>
        <p className="mt-1 text-sm text-mut">باقتك الحالية واستهلاكك مقابل الحدود — والترقية عند الحاجة.</p>
      </div>

      <div className={`rounded-xl border p-3 text-xs ${isReal ? "border-ok/30 bg-ok/10 text-ok" : "border-gold/30 bg-gold/10 text-gold"}`}>
        {isReal ? `● باقتك الحالية: «${plan.name}».` : "سجّل الدخول لعرض اشتراكك الحقيقي."}
      </div>

      {loading ? (
        <p className="text-sm text-mut">جارٍ التحميل…</p>
      ) : (
        <>
          {/* الاستهلاك */}
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="mb-4 text-sm font-bold text-fg">الاستهلاك الحالي — باقة «{plan.name}»</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <UsageBar label="المستخدمون" used={usage.users} limit={plan.limits.users} />
              <UsageBar label="العقارات" used={usage.properties} limit={plan.limits.properties} />
            </div>
          </section>

          {/* الباقات */}
          <section>
            <h2 className="mb-3 text-sm font-bold text-fg">الباقات</h2>
            <div className="grid gap-4 lg:grid-cols-5 sm:grid-cols-2">
              {PLANS.map((p) => {
                const current = p.key === plan.key;
                return (
                  <div key={p.key} className={`flex flex-col rounded-2xl border p-4 ${current ? "border-gold ring-2 ring-gold/40" : p.highlight ? "border-gold/40" : "border-line"} bg-card`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-fg">{p.name}</h3>
                      {current && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-golddark">الحالية</span>}
                    </div>
                    <div className="mt-2 text-xl font-extrabold text-fg">
                      {p.price === null ? "مخصّص" : p.price === 0 ? "مجاناً" : `${p.price} ر.س`}
                      {p.price ? <span className="text-xs font-normal text-mut"> /شهر</span> : null}
                    </div>
                    <div className="mt-1 text-xs text-mut">
                      👤 {fmtLimit(p.limits.users)} مستخدم · 🏢 {fmtLimit(p.limits.properties)} عقار
                    </div>
                    <ul className="mt-3 flex-1 space-y-1.5 text-xs text-mut">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-1.5"><span className="text-gold">✓</span>{f}</li>
                      ))}
                    </ul>
                    {!current && (
                      <a href="mailto:m.e.almuhanna@gmail.com?subject=ترقية الباقة"
                        className="mt-3 rounded-lg bg-gold px-3 py-2 text-center text-xs font-bold text-golddark hover:bg-gold/90">
                        {p.price === null ? "تواصل معنا" : "ترقية"}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-mut">الأسعار بالريال السعودي شهرياً، تُضاف ضريبة القيمة المضافة 15%. الدفع الإلكتروني قيد التفعيل.</p>
          </section>
        </>
      )}
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const near = !unlimited && used >= limit;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-fg">{label}</span>
        <span className={near ? "font-bold text-bad" : "text-mut"}>{used} / {fmtLimit(limit)}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-card2">
        <div className={`h-full rounded-full ${near ? "bg-bad" : "bg-gold"}`} style={{ width: unlimited ? "8%" : `${pct}%` }} />
      </div>
      {near && <p className="mt-1 text-xs text-bad">بلغت الحدّ — رقِّ باقتك للمزيد.</p>}
    </div>
  );
}
