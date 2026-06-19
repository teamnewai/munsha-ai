import type { Metadata } from "next";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "العملاء المؤسِّسون",
  description: "انضم كأحد أوّل 10 عملاء مؤسِّسين لمُلكي إدراك — 6 أشهر مجاناً وأولوية في الدعم وتشكيل المنتج.",
};

const PERKS = [
  { icon: "🎁", t: "6 أشهر مجاناً", d: "باقة الاحترافية كاملة بلا أي رسوم طوال فترة التأسيس." },
  { icon: "⚡", t: "إعداد فوري", d: "نُجهّز منشأتك وبياناتك الأولى معك في نفس اليوم." },
  { icon: "🎧", t: "دعم مباشر ذو أولوية", d: "قناة تواصل مباشرة معنا — طلباتك تُنفَّذ أولاً." },
  { icon: "🛠️", t: "تشكيل المنتج", d: "ملاحظاتك تتحوّل إلى مزايا — أنت تبني مُلكي معنا." },
];

const STEPS = [
  { n: "1", t: "أنشئ حسابك", d: "تسجيل بالبريد في أقل من دقيقة." },
  { n: "2", t: "جهّز منشأتك", d: "أو اضغط «عبّئ بيانات تجريبية» لتجربة فورية." },
  { n: "3", t: "أدِر أعمالك", d: "عقارات، عقود، فواتير، صيانة، فريق — في مكان واحد." },
];

export default function BetaPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />

      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-1.5 text-xs font-bold text-gold">
          ⭐ برنامج العملاء المؤسِّسين — مقاعد محدودة
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight text-fg sm:text-5xl">
          كن أحد أوّل <span className="text-gold">10 عملاء</span> لمُلكي إدراك
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-mut">
          نظام تشغيل أعمالك الكامل — مكتب افتراضي وإدارة عقارات ومساعد ذكي، عربيٌّ أولاً.
          ندعوك للانضمام مبكّراً بمزايا حصرية مقابل ملاحظاتك التي تشكّل المنتج.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/login?mode=signup" variant="primary" size="lg">
            انضمّ مجاناً الآن
          </ButtonLink>
          <ButtonLink href="/pricing" variant="secondary" size="lg">
            استعرض الباقات
          </ButtonLink>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map((p) => (
            <div key={p.t} className="rounded-2xl border border-line bg-card p-6">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/10 text-2xl">{p.icon}</div>
              <h3 className="mt-4 font-bold text-fg">{p.t}</h3>
              <p className="mt-1 text-sm text-mut">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-extrabold text-fg">ابدأ في 3 خطوات</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-card p-6 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-brand-950 font-extrabold text-white">{s.n}</div>
              <h3 className="mt-3 font-bold text-fg">{s.t}</h3>
              <p className="mt-1 text-sm text-mut">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="/login?mode=signup" variant="primary" size="lg">
            أنشئ منشأتك الآن — مجاناً
          </ButtonLink>
          <p className="mt-3 text-xs text-mut">بطاقة ائتمان غير مطلوبة · إلغاء في أي وقت.</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
