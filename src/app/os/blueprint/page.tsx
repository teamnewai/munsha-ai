"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { generateStructure, type GeneratedStructure } from "@/lib/orgGenerator";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Price = { scale: string; label: string; price: number; currency: string };
type Order = {
  id: string;
  scale: string;
  amount: number;
  currency: string;
  status: string;
  doc_no: string | null;
  created_at: string;
};

export default function BlueprintPage() {
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [input, setInput] = useState<{ activity?: string; employees?: number; name?: string } | null>(null);
  const [structure, setStructure] = useState<GeneratedStructure | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient()!;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);
    setEmail(user.email ?? null);
    const { data: m } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    // التسعير (مرجعي)
    const { data: pr } = await supabase.from("blueprint_pricing").select("scale, label, price, currency");
    if (pr) setPrices(pr.map((p) => ({ ...p, price: Number(p.price) })));

    if (m?.org_id) {
      setOrgId(m.org_id);
      const [{ data: doc }, { data: ord }] = await Promise.all([
        supabase
          .from("org_structure_docs")
          .select("input")
          .eq("org_id", m.org_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("blueprint_orders")
          .select("id, scale, amount, currency, status, doc_no, created_at")
          .eq("org_id", m.org_id)
          .order("created_at", { ascending: false }),
      ]);
      const inp = (doc?.input ?? {}) as { activity?: string; employees?: number; name?: string };
      if (inp.activity) {
        setInput(inp);
        setStructure(generateStructure(inp.activity, inp.employees ?? 20));
      }
      if (ord) setOrders(ord as Order[]);
    }
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const priceFor = (scale?: string) => prices.find((p) => p.scale === scale);
  const current = priceFor(structure?.scale);
  const paidOrder = orders.find((o) => o.status === "paid" || o.status === "issued");

  async function createOrder(simulatePaid: boolean) {
    if (!orgId || !structure || !current) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient()!;
    const docNo = `BP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    const { error } = await supabase.from("blueprint_orders").insert({
      org_id: orgId,
      user_id: userId,
      email,
      activity: input?.activity ?? null,
      staff: input?.employees ?? null,
      scale: structure.scale,
      amount: current.price,
      currency: current.currency,
      provider: "manual",
      status: simulatePaid ? "paid" : "pending",
      doc_no: docNo,
      paid_at: simulatePaid ? new Date().toISOString() : null,
      package: {
        deptCount: structure.deptCount,
        sectionCount: structure.sectionCount,
        roleCount: structure.roleCount,
        model: structure.model,
      },
    });
    setBusy(false);
    if (error) {
      setMsg("تعذّر إنشاء الطلب: " + error.message);
      return;
    }
    setMsg(simulatePaid ? "✅ تم الدفع (تجريبي) وإصدار الوثيقة." : "📝 تم إنشاء الطلب — بانتظار الدفع.");
    load();
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <header className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/os" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500 font-extrabold text-brand-950">
              🧬
            </span>
            <span className="text-sm font-extrabold">MULKI OS — إصدار وثيقة الهيكل</span>
          </Link>
          <Link href="/os" className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10">
            ← البوابات
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {loading ? (
          <p className="text-center text-slate-400">جارٍ التحميل...</p>
        ) : !structure ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-4xl">🧬</div>
            <h1 className="mt-4 text-2xl font-extrabold">لم يُبنَ هيكل بعد</h1>
            <p className="mx-auto mt-3 max-w-md text-slate-300">
              أنشئ مكتبك أولاً لتوليد الهيكل التنظيمي، ثم أصدر وثيقته المعتمدة من هنا.
            </p>
            <Link
              href="/onboarding"
              className="mt-6 inline-flex rounded-xl bg-gold-500 px-6 py-3 font-bold text-brand-950 hover:bg-gold-600"
            >
              أنشئ مكتبك ←
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* الخدمة + الهيكل */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h1 className="text-2xl font-extrabold">وثيقة الهيكل التنظيمي المعتمدة</h1>
              <p className="mt-2 text-sm text-slate-300">
                وثيقة احترافية لهيكل «{input?.name ?? "منشأتك"}» مبنية على أطر ISO / COBIT / PMI، تشمل
                الإدارات والأقسام والمناصب والصلاحيات — جاهزة للطباعة والاعتماد.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="فئة الحجم" value={current?.label?.split(" ")[1] ?? structure.scale} />
                <Stat label="الإدارات" value={String(structure.deptCount)} />
                <Stat label="الأقسام" value={String(structure.sectionCount)} />
                <Stat label="المناصب" value={String(structure.roleCount)} />
              </div>
              <p className="mt-3 text-sm text-slate-400">النموذج الإداري: {structure.model}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {structure.departments.map((d) => (
                  <span
                    key={d.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs"
                  >
                    <span>{d.icon}</span>
                    {d.name}
                  </span>
                ))}
              </div>
            </div>

            {/* الدفع */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-bold">إتمام الإصدار</h2>

              {paidOrder ? (
                <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
                  <div className="text-2xl">✅</div>
                  <p className="mt-2 font-bold text-emerald-300">الوثيقة مُصدرة</p>
                  <p className="mt-1 text-xs text-slate-300">
                    رقم الوثيقة: <span className="font-mono">{paidOrder.doc_no}</span>
                  </p>
                  <button
                    onClick={() => window.print()}
                    className="mt-4 w-full rounded-xl bg-gold-500 py-2.5 text-sm font-bold text-brand-950 hover:bg-gold-600"
                  >
                    🖨️ طباعة الوثيقة
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-4 flex items-baseline justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                    <span className="text-sm text-slate-300">{current?.label ?? structure.scale}</span>
                    <span className="text-2xl font-extrabold text-gold-400">
                      {current ? `${current.price} ${current.currency}` : "—"}
                    </span>
                  </div>

                  <button
                    onClick={() => createOrder(true)}
                    disabled={busy || !current}
                    className="mt-4 w-full rounded-xl bg-gold-500 py-3 text-sm font-bold text-brand-950 hover:bg-gold-600 disabled:opacity-60"
                  >
                    {busy ? "جارٍ المعالجة..." : "الدفع وإصدار الوثيقة"}
                  </button>
                  <button
                    onClick={() => createOrder(false)}
                    disabled={busy || !current}
                    className="mt-2 w-full rounded-xl border border-white/15 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                  >
                    إنشاء طلب والدفع لاحقاً
                  </button>
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
                    🔒 الدفع الإلكتروني المباشر قيد التفعيل. حالياً يُسجَّل الطلب في حسابك ويُصدر برقم
                    وثيقة. (مُلكي تسجّل المعاملة ولا تحوز الأموال — REOS.)
                  </p>
                </>
              )}

              {msg && <p className="mt-3 text-center text-sm text-slate-200">{msg}</p>}
            </div>
          </div>
        )}

        {/* سجل الطلبات */}
        {orders.length > 0 && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-3 text-sm font-bold text-slate-300">سجل الطلبات ({orders.length})</h3>
            <div className="space-y-2">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
                >
                  <span className="font-mono text-xs text-slate-300">{o.doc_no}</span>
                  <span className="text-slate-400">{new Date(o.created_at).toLocaleDateString("ar-SA")}</span>
                  <span className="font-bold text-gold-400">
                    {o.amount} {o.currency}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      o.status === "paid" || o.status === "issued"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {o.status === "paid" || o.status === "issued" ? "مدفوع" : "بانتظار الدفع"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
      <div className="text-xl font-extrabold text-gold-400">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
