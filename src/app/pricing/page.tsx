import type { Metadata } from "next";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "الأسعار" };

const TIERS = [
  {
    key: "growth",
    name: "النمو",
    price: 50,
    highlight: false,
    features: ["إدارة العقارات والوحدات", "العقود والفواتير", "طلبات الصيانة", "حتى 12 وحدة"],
  },
  {
    key: "professional",
    name: "الاحترافية",
    price: 150,
    highlight: true,
    features: ["كل مزايا النمو", "السكرتيرة الذكية «نور»", "التقارير الذكية", "اتحاد الملاك (HOA)"],
  },
  {
    key: "business",
    name: "الأعمال",
    price: 300,
    highlight: false,
    features: ["كل مزايا الاحترافية", "تحليلات متقدمة", "نظام التشغيل MULKI OS", "إدارة الفريق والصلاحيات"],
  },
  {
    key: "enterprise",
    name: "المؤسسات",
    price: 500,
    highlight: false,
    features: ["كل مزايا الأعمال", "علامة تجارية خاصة (White-label)", "دعم ذو أولوية", "تعدد الشركات"],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-brand-950">أسعار بسيطة وشفافة</h1>
          <p className="mx-auto mt-3 max-w-xl text-mut">
            جميع الباقات تشمل <strong>6 أشهر مجاناً</strong> للأعضاء المؤسسين. الأسعار بالريال
            السعودي شهرياً، تُضاف ضريبة القيمة المضافة 15%.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div
              key={t.key}
              className={`relative flex flex-col rounded-3xl border bg-card p-6 ${
                t.highlight
                  ? "border-brand-500 shadow-xl ring-2 ring-brand-500"
                  : "border-line"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-1 text-xs font-bold text-golddark">
                  الأكثر شيوعاً
                </span>
              )}
              <h3 className="text-lg font-bold text-fg">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-brand-950">{t.price}</span>
                <span className="text-mut">ر.س / شهرياً</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-mut">
                    <span className="mt-0.5 text-gold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <ButtonLink
                  href="/login?mode=signup"
                  variant={t.highlight ? "primary" : "secondary"}
                  size="md"
                  className="w-full"
                >
                  ابدأ مجاناً
                </ButtonLink>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-mut">
          إضافات مدفوعة اختيارية: جولة ثلاثية الأبعاد، مساعد AI، تحليلات، واتساب AI — تُضاف حسب الحاجة.
        </p>
      </section>
      <PublicFooter />
    </div>
  );
}
