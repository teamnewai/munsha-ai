import type { Metadata } from "next";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description: "سياسة خصوصية مُلكي — متوافقة مع نظام حماية البيانات الشخصية السعودي (PDPL).",
};

const SECTIONS = [
  {
    h: "1. مقدمة",
    p: "تلتزم منصة مُلكي بحماية خصوصية بياناتك وفقاً لنظام حماية البيانات الشخصية في المملكة العربية السعودية (PDPL). توضّح هذه السياسة كيف نجمع بياناتك ونستخدمها ونحميها.",
  },
  {
    h: "2. البيانات التي نجمعها",
    p: "بيانات الحساب (الاسم، البريد، الجوال)، بيانات المنشأة (النشاط، الموقع)، وبيانات التشغيل التي تُدخلها (العقارات، العقود، الفواتير). لا نجمع بيانات أكثر مما يلزم لتقديم الخدمة (مبدأ تقليل البيانات).",
  },
  {
    h: "3. أساس المعالجة والموافقة",
    p: "نعالج بياناتك بناءً على موافقتك عند التسجيل، ولتنفيذ العقد معك، وللامتثال للأنظمة. يمكنك سحب موافقتك في أي وقت عبر التواصل معنا.",
  },
  {
    h: "4. كيف نحمي بياناتك",
    p: "عزل تام بين المنشآت (Row-Level Security)، تشفير الاتصال (HTTPS)، سياسات وصول صارمة، وسجل تدقيق غير قابل للتعديل. لا تطّلع منشأة على بيانات منشأة أخرى أبداً.",
  },
  {
    h: "5. عدم حيازة الأموال",
    p: "وفقاً لمبدأ REOS، تُسجّل المنصة المعاملات المالية ولا تحتفظ بأموالك. تتم المدفوعات مباشرةً عبر قنوات الدفع المعتمدة.",
  },
  {
    h: "6. مشاركة البيانات",
    p: "لا نبيع بياناتك. قد نشاركها مع مزوّدي خدمات موثوقين (مثل الاستضافة وبوابات الدفع) بالقدر اللازم فقط، وضمن اتفاقيات حماية بيانات.",
  },
  {
    h: "7. حقوقك",
    p: "لك الحق في الوصول لبياناتك وتصحيحها وحذفها وتقييد معالجتها ونقلها، وفقاً لنظام PDPL.",
  },
  {
    h: "8. التواصل",
    p: "لأي استفسار يخص الخصوصية، تواصل معنا عبر واتساب: ‎+966 56 557 4784.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-extrabold text-fg">سياسة الخصوصية</h1>
        <p className="mt-2 text-sm text-mut">متوافقة مع نظام حماية البيانات الشخصية (PDPL) · آخر تحديث: 2026</p>
        <div className="mt-8 space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.h} className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-lg font-bold text-fg">{s.h}</h2>
              <p className="mt-2 text-sm leading-relaxed text-mut">{s.p}</p>
            </section>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
