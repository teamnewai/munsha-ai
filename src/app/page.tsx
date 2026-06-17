import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { ButtonLink } from "@/components/ui/Button";

const FEATURES = [
  {
    icon: "🏢",
    title: "إدارة العقارات والوحدات",
    desc: "سجل عقاراتك ووحداتك بأنواعها (شقق، فلل، مكاتب، محلات) مع متابعة الإشغال والإيجارات.",
  },
  {
    icon: "📄",
    title: "العقود والفواتير الذكية",
    desc: "أتمتة العقود والفواتير مع احتساب ضريبة القيمة المضافة 15% وتنبيهات التجديد.",
  },
  {
    icon: "🔧",
    title: "طلبات الصيانة مع SLA",
    desc: "دورة كاملة للصيانة: طلب → عرض سعر → موافقة → تنفيذ، مع تقييم مزودي الخدمة.",
  },
  {
    icon: "🤝",
    title: "اتحاد الملاك (HOA)",
    desc: "إدارة الرسوم، التصويت على القرارات، وحجز المرافق المشتركة.",
  },
  {
    icon: "🤖",
    title: "السكرتيرة الذكية «نور»",
    desc: "مساعد ذكي يقدّم ملخصاتك اليومية، يوجّه طلباتك، ويجيب عن أسئلتك بالعربية والصوت.",
  },
  {
    icon: "🌍",
    title: "متعدد اللغات والعملات",
    desc: "واجهة عربية أولاً مع دعم أكثر من 100 عملة، وبنية جاهزة لـ6 لغات.",
  },
];

const FAQS = [
  {
    q: "هل تحتفظ مُلكي بأموالي؟",
    a: "لا. مبدأ REOS الأساسي: المنصة تُسجّل المعاملات ولا تحتفظ بالأموال أبداً. الدفع يتم مباشرة بينك وبين الطرف الآخر عبر بوابات معتمدة.",
  },
  {
    q: "هل المنصة متوافقة مع الأنظمة السعودية؟",
    a: "نعم. احتساب ضريبة القيمة المضافة 15% (ZATCA)، حماية البيانات (PDPL)، وبنية جاهزة للتكامل مع نفاذ وفوترة ZATCA.",
  },
  {
    q: "هل يمكنني استيراد هيكل منشأتي تلقائياً؟",
    a: "نعم، عبر «جسر منشآتي» يمكنك استيراد الهيكل التنظيمي لمنشأتك المسجّلة في بوابة منشآت بنقرة واحدة.",
  },
  {
    q: "ما هو نظام التشغيل (MULKI OS)؟",
    a: "طبقة المكتب الافتراضي فوق النواة العقارية: مكاتب للموظفين، غرفة عمليات، مركز تحكم، وقوة عمل ذكية تعمل على مدار الساعة.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-4 py-1.5 text-sm font-medium text-gold-600">
            👑 6 أشهر مجاناً للأعضاء المؤسسين
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight text-brand-950 sm:text-6xl">
            مكتبك الكامل
            <br />
            <span className="text-gold">بلا جدران، بلا إيجار، بلا حدود</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-mut">
            مُلكي نظام تشغيل أعمالٍ يفصل العمل عن المكان: مكتب افتراضي متكامل، وسوق بيني يجلب
            العملاء، وحوكمة وذكاء اصطناعي يدير أعمالك — منصة واحدة، عربية أولاً.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/login?mode=signup" variant="primary" size="lg">
              ابدأ مجاناً
            </ButtonLink>
            <ButtonLink href="/#os" variant="secondary" size="lg">
              جولة في نظام التشغيل
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-brand-950 sm:text-4xl">كل ما تحتاجه منصّة واحدة</h2>
          <p className="mx-auto mt-3 max-w-2xl text-mut">
            من النواة العقارية (REOS) إلى نظام التشغيل الكامل.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-line bg-card p-6 transition-shadow hover:shadow-lg"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/10 text-2xl">
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-fg">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mut">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* OS Section */}
      <section id="os" className="bg-brand-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="text-sm font-bold text-gold-400">MULKI OS</span>
              <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">مكتبك الافتراضي يعمل 24/7</h2>
              <p className="mt-4 leading-relaxed text-mut">
                نظام التشغيل يحوّل البرمجيات المجرّدة إلى مكان عمل افتراضي قابل للتنقّل: مكاتب
                للموظفين، غرفة عمليات، مركز تحكم، وقوة عمل ذكية من وكلاء AI متخصصين.
              </p>
              <ul className="mt-6 space-y-3">
                {["مكتب افتراضي لكل موظف", "غرفة عمليات بمؤشرات لحظية", "قوة عمل ذكية (نور، المالية، العمليات)", "حوكمة ومصفوفة صلاحيات"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-3 text-mut">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-gold-500 text-xs text-brand-950">
                        ✓
                      </span>
                      {item}
                    </li>
                  )
                )}
              </ul>
              <div className="mt-8">
                <ButtonLink href="/os" variant="gold" size="lg">
                  ادخل نظام التشغيل
                </ButtonLink>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-card/5 p-8">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { k: "الأقسام النشطة", v: "14" },
                  { k: "وكلاء AI", v: "9" },
                  { k: "اللغات المدعومة", v: "6" },
                  { k: "العملات", v: "+100" },
                ].map((s) => (
                  <div key={s.k} className="rounded-2xl bg-brand-900/60 p-5 text-center">
                    <div className="text-3xl font-extrabold text-gold-400">{s.v}</div>
                    <div className="mt-1 text-sm text-mut">{s.k}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold text-brand-950 sm:text-4xl">الأسئلة الشائعة</h2>
        <div className="mt-10 space-y-4">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-line bg-card p-5 [&_summary]:cursor-pointer"
            >
              <summary className="flex items-center justify-between font-bold text-fg">
                {f.q}
                <span className="text-gold transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-mut">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-l from-gold to-gold/80 px-8 py-14 text-center text-golddark">
          <h2 className="text-3xl font-extrabold sm:text-4xl">جاهز تبدأ؟</h2>
          <p className="mmt-3 mx-auto mt-3 max-w-xl text-golddark/80">
            انضم لمُلكي اليوم واحصل على 6 أشهر مجاناً كعضو مؤسس.
          </p>
          <div className="mt-8">
            <ButtonLink href="/login?mode=signup" variant="gold" size="lg">
              أنشئ حسابك الآن
            </ButtonLink>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
