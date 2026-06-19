"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CATEGORIES, providersByCategory, PROVIDERS, type Provider } from "@/lib/providers";

// توجيه ذكي: يختار الزائر الخدمة → تظهر المنشآت المزوّدة المطابقة → يُرسل الطلب فيُوجَّه للمنشأة.

export function ServicesClient() {
  const params = useSearchParams();
  const initial = params.get("category") || "financial";
  const pName = params.get("p");
  const [cat, setCat] = useState<string>(CATEGORIES.some((c) => c.key === initial) ? initial : "financial");
  const [routedTo, setRoutedTo] = useState<Provider | null>(null);
  const [myCats, setMyCats] = useState<string[]>([]);
  const [myOrg, setMyOrg] = useState<string>("");

  // تحميل خدمات منشأتك المعروضة (الوضع التجريبي — تخزين محلي)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mulki:my-services");
      if (raw) {
        const v = JSON.parse(raw);
        setMyCats(Array.isArray(v.categories) ? v.categories : []);
        setMyOrg(typeof v.orgName === "string" ? v.orgName : "");
      }
    } catch { /* ignore */ }
  }, []);

  // توجيه مباشر لمنشأة محددة عبر ?p=
  useEffect(() => {
    if (!pName) return;
    const found = PROVIDERS.find((p) => p.name === pName);
    if (found) { setCat(found.category); setRoutedTo(found); }
  }, [pName]);

  const current = CATEGORIES.find((c) => c.key === cat)!;
  const providers = useMemo(() => {
    const base = providersByCategory(cat);
    if (myCats.includes(cat)) {
      const mine: Provider = {
        name: `${myOrg || "منشأتك"} (منشأتك)`, category: cat, city: "منشأتك",
        specialty: "خدمة معروضة من منشأتك", rating: 5, jobs: 0, verified: true,
      };
      return [mine, ...base];
    }
    return base;
  }, [cat, myCats, myOrg]);

  return (
    <div className="min-h-screen" dir="rtl">
      <header className="sticky top-0 z-30 backdrop-blur bg-background/70 border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-10 rounded-lg mulki-gold-bg flex items-center justify-center font-bold text-lg">م</div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight text-fg">مُلكي إدراك</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">سوق الخدمات</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/my-services" className="text-sm text-primary hover:underline">اعرض خدماتك</Link>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← الرئيسية</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-[0.22em] text-primary">توجيه ذكي</div>
          <h1 className="text-3xl md:text-4xl font-semibold mt-2 text-fg">اطلب خدمتك — نوجّهك للمنشأة المناسبة</h1>
          <p className="text-muted-foreground mt-3">اختر نوع الخدمة، وتظهر لك المنشآت المزوّدة المعتمدة، ويُوجَّه طلبك فوراً.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => { setCat(c.key); setRoutedTo(null); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                cat === c.key ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card/40 text-muted-foreground hover:text-foreground"}`}>
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        {routedTo ? (
          <RoutedConfirmation provider={routedTo} category={current.label} onReset={() => setRoutedTo(null)} />
        ) : (
          <>
            <div className="mulki-card p-4 mb-5 flex items-center gap-3">
              <span className="text-2xl">{current.emoji}</span>
              <div>
                <div className="font-semibold text-fg">{current.label}</div>
                <div className="text-xs text-muted-foreground">{current.desc} — {providers.length} منشأة مزوّدة معتمدة</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((p) => (
                <ProviderCard key={p.name} provider={p} onRoute={() => setRoutedTo(p)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProviderCard({ provider, onRoute }: { provider: Provider; onRoute: () => void }) {
  return (
    <div className="mulki-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center text-lg font-bold shrink-0">
          {provider.name.charAt(0)}
        </div>
        {provider.verified && (
          <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5">✓ موثّقة</span>
        )}
      </div>
      <div className="mt-3 font-semibold text-fg">{provider.name}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{provider.specialty}</div>
      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span>📍 {provider.city}</span>
        <span className="text-amber-400">★ {provider.rating}</span>
        <span>{provider.jobs} خدمة</span>
      </div>
      <button onClick={onRoute} className="mt-4 w-full rounded-xl mulki-gold-bg px-4 py-2.5 text-sm font-bold hover:opacity-90">
        وجّه طلبي لهذه المنشأة
      </button>
    </div>
  );
}

function RoutedConfirmation({ provider, category, onReset }: { provider: Provider; category: string; onReset: () => void }) {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");

  if (sent) {
    return (
      <div className="mulki-card p-8 max-w-xl mx-auto text-center">
        <div className="size-16 mx-auto rounded-full bg-emerald-500/15 text-emerald-400 grid place-items-center text-3xl">✓</div>
        <h2 className="mt-4 text-xl font-semibold text-fg">تم توجيه طلبك بنجاح</h2>
        <p className="text-sm text-muted-foreground mt-2">
          أُرسل طلب «{category}» إلى منشأة <span className="text-primary font-semibold">{provider.name}</span> — وسيتواصل معك مزوّد الخدمة قريباً عبر اتصال آمن داخل المنصة.
        </p>
        <div className="mt-3 inline-block rounded-lg border border-border bg-background/40 px-4 py-2 text-xs text-muted-foreground">
          رقم الطلب: SR-{Math.floor(1000 + Math.random() * 9000)} · الحالة: قيد المراجعة من المنشأة
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={onReset} className="rounded-xl bg-card2 px-5 py-2.5 text-sm font-bold text-fg hover:bg-card2/70">طلب خدمة أخرى</button>
          <Link href="/" className="rounded-xl border border-border px-5 py-2.5 text-sm">الرئيسية</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mulki-card p-6 md:p-8 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center text-lg font-bold">{provider.name.charAt(0)}</div>
        <div>
          <div className="text-xs text-muted-foreground">توجيه طلب «{category}» إلى</div>
          <div className="font-semibold text-fg">{provider.name}</div>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-3">
        <input required value={name} onChange={(e) => setName(e.target.value)} className="mulki-input" placeholder="الاسم" />
        <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mulki-input" placeholder="رقم التواصل — 05xxxxxxxx" />
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="mulki-input" rows={3} placeholder="تفاصيل طلبك (اختياري)" />
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="text-primary">🛡️</span> رقمك محمي — التواصل يتم عبر اتصال آمن داخل المنصة.
        </p>
        <div className="flex justify-between items-center">
          <button type="button" onClick={onReset} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <button type="submit" className="rounded-xl mulki-gold-bg px-6 py-2.5 text-sm font-bold hover:opacity-90">إرسال الطلب الموجّه ←</button>
        </div>
      </form>
    </div>
  );
}
