"use client";

import Link from "next/link";
import { useState } from "react";

// مُلكي إدراك — الصفحة الرئيسية (مستنسخة من منصة MULKI OS مع ربط الخدمات بصفحات المنصة)

const whyMulki = [
  { emoji: "🏢", title: "مكتب كامل — طبيعي أو افتراضي", desc: "إداراتك ومناصبك وأنظمتك في منصّة واحدة تتكيّف مع نشاطك." },
  { emoji: "🔗", title: "كل أدواتك متكاملة", desc: "محاسبة وفاتورة ZATCA، متاجر، دفع، تواصل — مربوطة في مكان واحد." },
  { emoji: "🤖", title: "بشر + وكلاء ذكاء + حوكمة", desc: "الأقسام الشاغرة يشغّلها الذكاء بأمرك، بصلاحيات ودورة مستندية منضبطة." },
  { emoji: "📍", title: "عنوان وطني معتمد (قريباً)", desc: "هوية رسمية لمنشأتك مبنية على عنوانك المعتمد." },
];

const heroActions = [
  { label: "اطلب وحدة", emoji: "🏠", to: "/login?mode=signup" },
  { label: "اطلب صيانة", emoji: "🔧", to: "/login?mode=signup" },
  { label: "أنشئ مكتبك", emoji: "⬡", to: "/onboarding", primary: true },
  { label: "اطلب نظافة", emoji: "🧹", to: "/login?mode=signup" },
  { label: "اطلب مقاول", emoji: "👷", to: "/login?mode=signup" },
];

const consultants = [
  { emoji: "⚖️", title: "مستشار قانوني", sub: "عقود · امتثال" },
  { emoji: "📊", title: "مستشار إداري", sub: "تنظيم · حوكمة" },
  { emoji: "💻", title: "مستشار تقني", sub: "أنظمة · تحول رقمي" },
  { emoji: "🤖", title: "مستشار AI", sub: "ذكاء اصطناعي" },
];

const specialServices = [
  { emoji: "🧾", title: "موظف حسابات", sub: "محاسب · مدير مالي" },
  { emoji: "🛎️", title: "موظف خدمات عامة", sub: "دوائر · منصات حكومية" },
  { emoji: "🛡️", title: "خدمات التأمين", sub: "تأمين · بوالص" },
];

const requestKinds = [
  { emoji: "🏠", label: "اطلب وحدة", sub: "للإيجار" },
  { emoji: "🔧", label: "اطلب صيانة", sub: "صيانة · ترميم" },
  { emoji: "🧹", label: "اطلب نظافة", sub: "تنظيف · تعقيم" },
  { emoji: "👷", label: "اطلب مقاول", sub: "بناء · تشطيب" },
];

const clients = [
  "مجموعة الرياض العقارية", "دار التمليك", "أملاك الخليج", "بيوت المستقبل",
  "العقارية المتحدة", "منازل الوطن", "إعمار الديار", "صروح الإسكان",
];

const platformServices = [
  { n: "01", emoji: "🏢", title: "إدارة الوحدات والعقود", desc: "أدِر محفظتك بالكامل من نظام واحد: عقارات، وحدات، عقود، وتحصيل. استورد آلاف الوحدات من Excel بضغطة، وتابع الإشغال والشغور لحظياً." },
  { n: "02", emoji: "🔧", title: "سوق الصيانة الذكي", desc: "اطلب الصيانة فتصلك عروض من موفّرين معتمدين برتيب يوازن بين الجودة والسعر والالتزام والسرعة، مع إثباتات قبل/بعد لكل عملية." },
  { n: "03", emoji: "🧾", title: "المالية والفواتير", desc: "كشوف وفواتير ومتأخرات بأعمار الديون، احتساب تلقائي لصافي الدخل و ROI، VAT 15% وجاهزية الزكاة مدمجة." },
  { n: "04", emoji: "📈", title: "محرّك العملاء المحتملين", desc: "حوّل زوّار موقعك إلى عملاء فعليين: نموذج «اطلب خدمتك» يلتقط الطلبات ويوزّعها جغرافياً على المزوّدين، مع اتصال آمن." },
  { n: "05", emoji: "🏘️", title: "مجتمعات HOA", desc: "اتحادات الملّاك بحوكمة متكاملة: تصويت إلكتروني شفّاف، تحصيل رسوم، وحجز المرافق المشتركة — كل ذلك في مكان واحد." },
  { n: "06", emoji: "🤖", title: "ذكاء اصطناعي وعلامة بيضاء", desc: "مساعد ذكي يحلّل محفظتك ويقترح القرارات ويكتب إعلانات الوحدات الشاغرة، مع لوحة White-Label بهويتك أنت." },
];

const banks = [
  { name: "البنك الأهلي", type: "بنك" },
  { name: "مصرف الراجحي", type: "بنك" },
  { name: "بنك الرياض", type: "بنك" },
  { name: "البنك السعودي الأول", type: "بنك" },
  { name: "صندوق التنمية العقارية", type: "تمويل" },
  { name: "بنك التنمية الاجتماعية", type: "تمويل" },
  { name: "كفالة — تمويل المنشآت", type: "تمويل" },
  { name: "منشآت — الهيئة العامة", type: "تمويل" },
];

const platforms = [
  { emoji: "📊", title: "نظام جداول", sub: "محاسبة وفوترة" },
  { emoji: "📒", title: "نظام دفترة", sub: "إدارة أعمال ومحاسبة" },
  { emoji: "🧮", title: "نظام قيود", sub: "محاسبة سحابية" },
  { emoji: "🛍️", title: "منصة سلة", sub: "متاجر إلكترونية" },
  { emoji: "🛒", title: "منصة زد", sub: "متاجر إلكترونية" },
];

const faqs = [
  { q: "هل تحوز مُلكي أموالي أو إيجارات المستأجرين؟", a: "لا إطلاقاً. مُلكي منصة تسجيل وتنظيم فقط (REOS) — لا تحوز ولا تحوّل أي أموال. التحصيل يتم عبر قنواتك المباشرة، والمنصة تسجّله وتنظّمه فقط." },
  { q: "كيف تعمل فترة الـ٦ أشهر المجانية؟", a: "تبدأ من تاريخ إضافتك لأول وحدة، وخلالها تستخدم كل الخصائص مجاناً. العرض الحالي لأول ١٠٠ مشترك ولفترة محدودة." },
  { q: "هل أحتاج خبرة تقنية لاستخدام المنصة؟", a: "لا. الواجهة عربية بالكامل وسهلة، وفيها دليل إرشادي تفاعلي داخل لوحة التحكم يرشدك خطوة بخطوة." },
  { q: "هل يوجد تطبيق جوال؟", a: "نعم. يمكنك تثبيت مُلكي كتطبيق عبر «إضافة إلى الشاشة الرئيسية» — يعمل بملء الشاشة كتطبيق أصلي مرتبط بحسابك." },
  { q: "كيف أسوّق وحداتي الشاغرة؟", a: "بضغطة تحوّل الوحدة الشاغرة إلى إعلان جاهز وتنشره على المنصات العقارية الكبرى، مع نسخ النص تلقائياً." },
  { q: "هل بياناتي آمنة؟", a: "نعم. حماية على مستوى قاعدة البيانات (صلاحيات لكل دور)، رؤوس أمان معيارية، وتشفير الاتصال (SSL). كل منشأة ترى بياناتها فقط." },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [bannerOpen, setBannerOpen] = useState(true);

  return (
    <div className="min-h-screen" dir="rtl">
      {/* شريط الإطلاق */}
      {bannerOpen && (
        <div className="relative mulki-gold-bg text-[var(--gold-foreground)] text-xs sm:text-sm">
          <div className="mx-auto max-w-7xl px-6 py-2 flex items-center justify-center gap-2 text-center">
            <span className="font-semibold">عرض الإطلاق 🎉</span>
            <span>٦ أشهر مجاناً لأول 100 مشترك — حتى ٣١ أغسطس ٢٠٢٦</span>
            <Link href="/login?mode=signup" className="underline font-semibold">اشترك الآن</Link>
          </div>
          <button onClick={() => setBannerOpen(false)} className="absolute top-1/2 -translate-y-1/2 start-4 text-base font-bold opacity-70 hover:opacity-100">×</button>
        </div>
      )}

      {/* الترويسة */}
      <header className="sticky top-0 z-30 backdrop-blur bg-background/70 border-b border-border">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-10 rounded-lg mulki-gold-bg flex items-center justify-center font-bold text-lg">م</div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight text-fg">مُلكي إدراك</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">حلول الأعمال والتقنية</div>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#request" className="hover:text-foreground">اطلب خدمة</a>
            <a href="#features" className="hover:text-foreground">المزايا</a>
            <a href="#clients" className="hover:text-foreground">عملاؤنا</a>
            <a href="#app" className="hover:text-foreground">التطبيق</a>
            <a href="#pricing" className="hover:text-foreground">التسعير</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-mut hover:bg-card2">دخول</Link>
            <Link href="/login?mode=signup" className="rounded-lg mulki-gold-bg px-3 py-1.5 text-sm font-bold hover:opacity-90">ابدأ مجاناً</Link>
          </div>
        </div>
      </header>

      {/* الهيرو */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 mulki-grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground mulki-glow">
              <span className="text-primary">✦</span> نظام تشغيل المنشأة — للمكتب الطبيعي والافتراضي
            </div>
            <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.15] text-fg">
              نظام تشغيل <span className="mulki-gold-text">شركتك السحابي</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
              مكتبك الافتراضي الكامل — إدارات وموظفون ووكلاء ذكاء وحوكمة، تديرها من أي مكان. للمكتب الطبيعي والافتراضي معاً، عبر البناء والتكامل مع أدواتك المفضّلة.
            </p>
            <div className="mt-8 space-y-2.5">
              {/* أنشئ مكتبك — زر رئيسي طويل */}
              {heroActions.filter((a) => a.primary).map((a) => (
                <Link
                  key={a.label}
                  href={a.to}
                  className="flex w-full items-center justify-center gap-2 rounded-xl mulki-gold-bg px-5 py-3.5 text-base font-extrabold hover:opacity-90"
                >
                  <span className="text-lg">{a.emoji}</span>
                  {a.label}
                </Link>
              ))}
              {/* باقي الخدمات — متجاورة تحته */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {heroActions.filter((a) => !a.primary).map((a) => (
                  <Link
                    key={a.label}
                    href={a.to}
                    className="flex items-center justify-center gap-2 rounded-xl bg-card2 px-3 py-2.5 text-sm font-bold text-fg hover:bg-card2/70"
                  >
                    <span>{a.emoji}</span>
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">٦ أشهر مجانية لكل الخدمات خلال فترة الإطلاق.</p>
          </div>

          {/* جولة افتراضية */}
          <div className="relative flex flex-col items-center justify-center gap-4">
            <Link href="/dashboard" className="group relative block focus:outline-none" aria-label="ابدأ الجولة الافتراضية">
              <div className="absolute inset-0 -m-6 rounded-[3rem] bg-primary/20 blur-3xl opacity-60 group-hover:opacity-90 transition-opacity" />
              <div className="relative w-64 md:w-72 h-[460px] rounded-[2.5rem] border-4 border-border bg-background mulki-glow overflow-hidden">
                <div className="absolute top-3 inset-x-0 mx-auto w-20 h-5 rounded-full bg-border" />
                <div className="absolute inset-5 top-12 rounded-2xl border border-primary/30 p-4 space-y-3" style={{ background: "var(--gradient-surface)" }}>
                  <div className="h-8 rounded mulki-gold-bg opacity-80" />
                  <div className="h-3 rounded bg-primary/15" />
                  <div className="h-3 rounded bg-primary/15 w-3/4" />
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {[1,2,3,4].map((i) => <div key={i} className="aspect-square rounded-xl bg-primary/20" />)}
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="size-16 rounded-full mulki-gold-bg flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform text-2xl">▶</div>
                </div>
              </div>
            </Link>
            <div className="text-center">
              <div className="text-lg font-semibold mulki-gold-text">الجولة الافتراضية</div>
              <div className="text-xs text-muted-foreground mt-1">اضغط لاستكشاف المنصة ولوحات التحكم</div>
            </div>
          </div>
        </div>
      </section>

      {/* لماذا مُلكي */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-[0.22em] text-primary">المزايا</div>
          <h2 className="text-3xl md:text-4xl font-semibold mt-2 text-fg">لماذا مُلكي؟</h2>
          <p className="text-muted-foreground mt-3">نظام تشغيل متكامل لمنشأتك — للمكتب الطبيعي والافتراضي معاً.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {whyMulki.map((f) => (
            <div key={f.title} className="mulki-card p-6">
              <div className="text-3xl mb-3">{f.emoji}</div>
              <h3 className="font-semibold mb-1.5 text-fg">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* المكتب الافتراضي */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mulki-card p-10 md:p-14 relative overflow-hidden">
          <div className="absolute -start-24 -top-24 size-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-primary">جديد · MULKI OS</div>
              <h2 className="text-3xl md:text-4xl font-semibold mt-2 text-fg">افتح مكتبك الافتراضي الذكي</h2>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                أدخل بيانات منشأتك (النشاط · النوع · الدولة · عدد الموظفين)، وابنِ هيكلك التنظيمي وإداراتك ومناصبها ومهامها وصلاحياتها — بنفسك أو بنظام منشآتي AI — وينعكس كل شيء في لوحتك.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-xl mulki-gold-bg px-5 py-2.5 text-sm font-bold hover:opacity-90">⬡ افتح مكتبك الافتراضي</Link>
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-card2 px-5 py-2.5 text-sm font-bold text-fg hover:bg-card2/70">دخول المكتب ←</Link>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-6">
              <div className="flex items-center gap-2 text-sm text-primary mb-4">⬡ مكتبك الافتراضي · MULKI OS</div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                نظام تشغيل المنشأة الافتراضي: إدارات بأقسامها ومناصبها ومهامها وصلاحياتها، دورة مستندية، واعتماد رسمي — مكتب متكامل يعمل أينما كنت.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["🏢","إدارات"],["🤖","وكلاء AI"],["🔀","سير عمل"],["👑","حوكمة"],["🧠","معرفة"],["🛡️","صلاحيات"]].map(([e,l]) => (
                  <div key={l} className="rounded-lg border border-border/60 bg-card/40 p-3">
                    <div className="text-lg">{e}</div>
                    <div className="text-xs mt-1">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* المستشارون والخدمات الخاصة */}
      <section className="mx-auto max-w-7xl px-6 py-12 space-y-10">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-primary mb-3">مستشارون</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {consultants.map((c) => (
              <Link href="/login?mode=signup" key={c.title} className="mulki-card p-5 hover:border-primary/50 transition-colors text-center">
                <div className="text-3xl mb-2">{c.emoji}</div>
                <div className="font-semibold text-fg">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-primary mb-3">خدمات خاصة</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {specialServices.map((c) => (
              <Link href="/login?mode=signup" key={c.title} className="mulki-card p-5 hover:border-primary/50 transition-colors text-center">
                <div className="text-3xl mb-2">{c.emoji}</div>
                <div className="font-semibold text-fg">اطلب {c.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
              </Link>
            ))}
          </div>
          <div className="text-center text-xs text-muted-foreground mt-4">
            بالشراكة مع <span className="text-foreground">🇸🇦 مركز الأعمال السعودي</span>
          </div>
        </div>
      </section>

      {/* اطلب خدمة */}
      <section id="request" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.22em] text-primary">اطلب الآن</div>
          <h2 className="text-3xl md:text-4xl font-semibold mt-2 text-fg">تبحث عن وحدة أو تحتاج خدمة؟</h2>
          <p className="text-muted-foreground mt-3">اختر نوع طلبك ويصلك المزوّدون المعتمدون في منطقتك — مجاناً.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {requestKinds.map((r) => (
            <Link href="/login?mode=signup" key={r.label} className="mulki-card p-5 hover:border-primary/50 transition-colors text-center">
              <div className="text-3xl mb-2">{r.emoji}</div>
              <div className="font-semibold text-fg">{r.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{r.sub}</div>
            </Link>
          ))}
        </div>
        <form action="/login?mode=signup" className="mulki-card p-6 md:p-8 max-w-3xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="الدولة">
              <select className="mulki-input">
                <option>السعودية</option><option>الإمارات</option><option>الكويت</option>
                <option>قطر</option><option>البحرين</option><option>عُمان</option>
                <option>مصر</option><option>الأردن</option><option>تركيا</option>
                <option>المملكة المتحدة</option><option>الولايات المتحدة</option><option>دولة أخرى</option>
              </select>
            </Field>
            <Field label="المنطقة (اختياري)"><input className="mulki-input" placeholder="مثلاً: الرياض" /></Field>
            <Field label="المدينة *"><input className="mulki-input" placeholder="المدينة" /></Field>
            <Field label="نوع الوحدة">
              <select className="mulki-input">
                <option>شقة</option><option>فيلا</option><option>استوديو</option><option>غرفة</option>
                <option>محل</option><option>مكتب</option><option>أرض</option><option>مستودع</option>
              </select>
            </Field>
            <Field label="الغرف"><input className="mulki-input" type="number" min={0} /></Field>
            <Field label="الحمامات"><input className="mulki-input" type="number" min={0} /></Field>
            <Field label="الميزانية"><input className="mulki-input" placeholder="بالريال" /></Field>
            <Field label="الاسم (اختياري)"><input className="mulki-input" /></Field>
            <div className="md:col-span-2">
              <Field label="رقم التواصل *"><input className="mulki-input" placeholder="05xxxxxxxx" /></Field>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-2">
            <span className="text-primary">🛡️</span>
            رقمك محمي — لا يظهر للمزوّد، والتواصل يتم عبر اتصال آمن داخل المنصة.
          </p>
          <div className="mt-5 flex justify-end">
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl mulki-gold-bg px-6 py-2.5 text-sm font-bold hover:opacity-90">إرسال الطلب ←</button>
          </div>
        </form>
      </section>

      {/* العملاء */}
      <section id="clients" className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.22em] text-primary">عملاؤنا</div>
          <h2 className="text-3xl md:text-4xl font-semibold mt-2 text-fg">شركات ومكاتب عقارية تثق بمُلكي</h2>
          <p className="text-muted-foreground mt-3">نفخر بخدمة نخبة من العملاء في القطاع العقاري.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {clients.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm text-fg">{c}</div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">عيّنة عرض — تُستبدل بشعارات عملائك الفعليين.</p>
      </section>

      {/* الخدمات المرقّمة */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-[0.22em] text-primary">الخدمات</div>
          <h2 className="text-3xl md:text-4xl font-semibold mt-2 text-fg">نظام واحد يجمع كل شيء — بذكاء</h2>
          <p className="text-muted-foreground mt-3">من جذب العميل إلى إدارة الوحدة — دورة كاملة في منصة واحدة.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platformServices.map((s) => (
            <div key={s.n} className="mulki-card p-6 relative">
              <div className="absolute top-4 end-4 text-4xl font-bold text-primary/20">{s.n}</div>
              <div className="text-2xl mb-3">{s.emoji}</div>
              <h3 className="font-semibold mb-2 text-fg">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* البنوك */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-semibold text-fg">البنوك وجهات التمويل</h2>
          <p className="text-muted-foreground mt-3">تواصل مع مسوّقي البنوك وجهات التمويل عبر مكاتبهم الافتراضية — لتمويل مشاريعك وعملائك.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {banks.map((b) => (
            <div key={b.name} className="mulki-card p-5">
              <div className="size-9 rounded-md bg-primary/15 text-primary flex items-center justify-center mb-3">🏦</div>
              <div className="font-semibold text-sm text-fg">{b.name}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{b.type}</div>
              <Link href="/dashboard/providers" className="text-xs text-primary mt-3 inline-flex items-center gap-1">تواصل ←</Link>
            </div>
          ))}
        </div>
      </section>

      {/* المنصّات */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold text-fg">منصّات إلكترونية تهمّك</h2>
          <p className="text-muted-foreground mt-3 text-sm">أنظمة محاسبة وتجارة إلكترونية — تكامل مباشر قيد التفعيل.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {platforms.map((p) => (
            <div key={p.title} className="mulki-card p-4 text-center">
              <div className="text-3xl mb-2">{p.emoji}</div>
              <div className="font-semibold text-sm text-fg">{p.title}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{p.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* التسعير */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mulki-card p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute -end-32 -bottom-32 size-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-semibold text-fg">
              <span className="mulki-gold-text">٦ أشهر مجانية</span> لكل الخدمات
            </h2>
            <p className="text-muted-foreground mt-4">تبدأ من تاريخ إضافة أول وحدة · ثم تسعير عادل بالاستخدام.</p>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl mulki-gold-bg px-6 py-3 text-sm font-bold hover:opacity-90 mt-8">استعرض الباقات ←</Link>
          </div>
        </div>
      </section>

      {/* تطبيق الجوال */}
      <section id="app" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-primary">تطبيق مُلكي</div>
            <h2 className="text-3xl md:text-4xl font-semibold mt-2 text-fg">أدِر مكتبك من جوّالك أينما كنت</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              حمّل تطبيق مُلكي وتابع وحداتك وعقودك وطلبات الصيانة وإشعاراتك لحظياً — من أي مكان وفي أي وقت.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-3 rounded-xl bg-card2 px-5 py-2.5 text-fg">📱 <span className="text-start leading-tight"><span className="block text-[10px] opacity-70">حمّله من</span><span className="block font-semibold">App Store</span></span></span>
              <span className="inline-flex items-center gap-3 rounded-xl bg-card2 px-5 py-2.5 text-fg">📱 <span className="text-start leading-tight"><span className="block text-[10px] opacity-70">حمّله من</span><span className="block font-semibold">Google Play</span></span></span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">ثبّت التطبيق الآن عبر «إضافة للشاشة الرئيسية» — أو من المتاجر قريباً.</p>
          </div>
          <div className="mulki-card p-8 md:p-12 flex items-center justify-center">
            <div className="w-48 h-96 rounded-[2rem] border-4 border-border bg-background relative overflow-hidden mulki-glow">
              <div className="absolute top-2 inset-x-0 mx-auto w-16 h-4 rounded-full bg-border" />
              <div className="absolute inset-4 top-10 rounded-2xl border border-primary/30 p-3 space-y-2" style={{ background: "var(--gradient-surface)" }}>
                <div className="h-6 rounded mulki-gold-bg opacity-80" />
                <div className="h-3 rounded bg-primary/15" />
                <div className="h-3 rounded bg-primary/15 w-3/4" />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[1,2,3,4].map((i) => <div key={i} className="aspect-square rounded-lg bg-primary/20" />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* برنامج الشركاء */}
      <section id="affiliate" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mulki-card p-8 md:p-14 relative overflow-hidden">
          <div className="absolute -start-32 -top-32 size-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative grid lg:grid-cols-[auto_1fr] gap-8 items-center">
            <div className="flex justify-center">
              <div className="size-28 md:size-32 rounded-3xl mulki-gold-bg flex items-center justify-center shadow-2xl mulki-glow text-5xl">🤝</div>
            </div>
            <div className="text-center lg:text-start">
              <div className="text-xs uppercase tracking-[0.22em] text-primary">برنامج الشركاء</div>
              <h2 className="text-3xl md:text-4xl font-semibold mt-2 text-fg">كن <span className="mulki-gold-text">شريكاً تابعاً</span> مع مُلكي OS</h2>
              <p className="text-muted-foreground mt-4 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                انضم لبرنامج الشركاء التسويقيين واربح عمولات مجزية على كل عميل تجلبه. لوحة شريك متكاملة لإدارة العملاء، تتبّع العمولات، ومدير حساب مخصّص لدعمك.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[["💰","عمولات مجزية","على كل اشتراك"],["📈","لوحة شريك","تتبّع وتحليلات"],["👥","مدير حساب","دعم مخصّص"]].map(([e,t,s]) => (
                  <div key={t} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3">
                    <span className="text-xl shrink-0">{e}</span>
                    <div className="text-start"><div className="font-semibold text-sm text-fg">{t}</div><div className="text-[11px] text-muted-foreground">{s}</div></div>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap gap-3 justify-center lg:justify-start">
                <Link href="/beta" className="inline-flex items-center gap-2 rounded-xl mulki-gold-bg px-5 py-2.5 text-sm font-bold hover:opacity-90">🤝 انضم كشريك تابع</Link>
                <Link href="/beta" className="inline-flex items-center gap-2 rounded-xl bg-card2 px-5 py-2.5 text-sm font-bold text-fg hover:bg-card2/70">لوحة الشريك ←</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* الأسئلة الشائعة */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.22em] text-primary">الأسئلة الشائعة</div>
          <h2 className="text-3xl md:text-4xl font-semibold mt-2 text-fg">أسئلة يطرحها عملاؤنا</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={i} className="mulki-card overflow-hidden">
                <button onClick={() => setOpenFaq(open ? null : i)} className="w-full flex items-center justify-between gap-4 p-5 text-start">
                  <span className="font-semibold text-sm md:text-base text-fg">{f.q}</span>
                  <span className="text-primary shrink-0">{open ? "▾" : "+"}</span>
                </button>
                {open && <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4">{f.a}</div>}
              </div>
            );
          })}
        </div>
        <div className="text-center mt-10 text-sm text-muted-foreground">
          تحدّث معنا{" "}
          <a href="https://api.whatsapp.com/send?phone=966565574784" className="inline-flex items-center gap-1.5 text-primary hover:underline">💬 تواصل عبر واتساب</a>
        </div>
      </section>

      {/* التذييل */}
      <footer className="border-t border-border mt-10">
        <div className="mx-auto max-w-7xl px-6 py-8 grid md:grid-cols-3 gap-6 text-xs text-muted-foreground">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="size-8 rounded-md mulki-gold-bg flex items-center justify-center font-bold">م</div>
              <div className="font-semibold text-foreground">مُلكي إدراك</div>
            </div>
            <p>© مُلكي OS — نظام تشغيل المؤسسات.</p>
          </div>
          <div className="flex flex-wrap gap-4 md:justify-center">
            <Link href="/dashboard" className="hover:text-foreground">لوحة التحكم</Link>
            <Link href="/dashboard/providers" className="hover:text-foreground">سوق الخدمات</Link>
            <Link href="/os/desk" className="hover:text-foreground">نور AI</Link>
            <Link href="/login" className="hover:text-foreground">دخول</Link>
          </div>
          <div className="flex flex-wrap gap-4 md:justify-end">
            <Link href="/privacy" className="hover:text-foreground">الخصوصية</Link>
            <Link href="/terms" className="hover:text-foreground">الشروط</Link>
            <Link href="/pricing" className="hover:text-foreground">التسعير</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
