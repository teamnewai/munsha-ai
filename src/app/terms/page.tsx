import type { Metadata } from "next";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";

export const metadata: Metadata = {
  title: "الشروط والأحكام",
  description: "الشروط والأحكام واستخدام منصة مُلكي.",
};

const SECTIONS = [
  { id: "", h: "1. قبول الشروط", p: "باستخدامك منصة مُلكي فإنك توافق على هذه الشروط. إن لم توافق، يُرجى عدم استخدام المنصة." },
  { id: "", h: "2. وصف الخدمة", p: "مُلكي نظام تشغيل أعمال يقدّم مكتباً افتراضياً وإدارة عقارية وحوكمة وسوقاً بينياً وأدوات ذكاء اصطناعي للمنشآت." },
  { id: "", h: "3. الحساب والاشتراك", p: "أنت مسؤول عن سرّية بيانات دخولك. تتوفّر باقات مجانية ومدفوعة، وتُحتسب الفاتورة بالأعلى بين استخدامك الفعلي وحدّ باقتك." },
  { id: "zatca", h: "4. الفوترة والضريبة (ZATCA)", p: "تُضاف ضريبة القيمة المضافة 15% وفقاً لأنظمة هيئة الزكاة والضريبة والجمارك. الأسعار المعروضة بالريال السعودي ما لم يُذكر غير ذلك." },
  { id: "", h: "5. عدم حيازة الأموال (REOS)", p: "تُسجّل المنصة المعاملات ولا تحتفظ بالأموال؛ تتم المدفوعات مباشرةً بين الأطراف عبر بوابات معتمدة. المنصة ليست وسيط دفع." },
  { id: "", h: "6. الاستخدام المقبول", p: "يُمنع استخدام المنصة لأي غرض غير قانوني أو ينتهك حقوق الغير أو يحاول اختراق الأنظمة أو تجاوز عزل البيانات." },
  { id: "", h: "7. الملكية الفكرية", p: "جميع حقوق المنصة وعلامتها التجارية مملوكة لمُلكي. تبقى بياناتك التشغيلية ملكك." },
  { id: "", h: "8. حدود المسؤولية", p: "تُقدَّم الخدمة «كما هي». لا نتحمّل المسؤولية عن أضرار غير مباشرة ضمن الحدود التي يسمح بها النظام." },
  { id: "", h: "9. التعديلات والتواصل", p: "قد نُحدّث هذه الشروط، ونُشعرك بالتغييرات الجوهرية. للتواصل: واتساب ‎+966 56 557 4784. الكيان مسجّل في الإمارات العربية المتحدة." },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-extrabold text-fg">الشروط والأحكام</h1>
        <p className="mt-2 text-sm text-mut">آخر تحديث: 2026</p>
        <div className="mt-8 space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.h} id={s.id || undefined} className="scroll-mt-20 rounded-2xl border border-line bg-card p-6">
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
