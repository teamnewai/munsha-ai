"use client";

import Link from "next/link";
import { SmartSecretary } from "@/components/os/SmartSecretary";

// مكتب الموظف «مكتب محمد» — مرجع: وثيقة «الشجرة» §323-327
// 15 أداة؛ أيقونات أوفيس مربوطة بمايكروسوفت 365 (تبويب جديد).
const TOOLS: { icon: string; label: string; href?: string }[] = [
  { icon: "📝", label: "Word", href: "https://www.microsoft365.com/launch/word" },
  { icon: "📊", label: "Excel", href: "https://www.microsoft365.com/launch/excel" },
  { icon: "📽️", label: "PowerPoint", href: "https://www.microsoft365.com/launch/powerpoint" },
  { icon: "📧", label: "Outlook", href: "https://outlook.office.com" },
  { icon: "🪑", label: "كرسي الضيف" },
  { icon: "🧮", label: "الآلة الحاسبة" },
  { icon: "📅", label: "التقويم" },
  { icon: "🛎️", label: "طلب خدمة" },
  { icon: "🗒️", label: "الملاحظات" },
  { icon: "💬", label: "المحادثات" },
  { icon: "📞", label: "سجل المكالمات" },
  { icon: "📂", label: "ملفاتي الحديثة" },
  { icon: "✅", label: "المهام والتذكير" },
  { icon: "📨", label: "متابعة الطلبات" },
  { icon: "🕐", label: "الحضور والانصراف" },
];

const DAILY_TASKS = [
  { t: "مراجعة عقد الوحدة A-204", done: false },
  { t: "اعتماد فاتورة صيانة التكييف", done: false },
  { t: "الرد على استفسار مستأجر برج العليا", done: true },
];

const RETURNED = [
  { t: "طلب صرف #1042 — ناقص مرفق", p: "عالٍ" },
  { t: "خطاب تعميد — يحتاج توقيع المدير", p: "متوسط" },
];

export default function DeskPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      {/* شريط السياق */}
      <header className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/os" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500 font-extrabold text-brand-950">
              🪑
            </span>
            <div className="text-sm">
              <div className="font-extrabold">مكتب محمد</div>
              <div className="text-xs text-slate-400">المالية · المحاسبة · محاسب أول</div>
            </div>
          </Link>
          <div className="text-xs text-slate-400">
            {new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[300px_1fr_280px]">
        {/* العمود الأيمن — المساعد الذكي نور */}
        <div className="order-1 lg:h-[calc(100vh-7rem)]">
          <SmartSecretary />
        </div>

        {/* العمود الأوسط — الأدوات */}
        <div className="order-3 lg:order-2">
          <h2 className="mb-3 text-sm font-bold text-slate-300">الأدوات (15)</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {TOOLS.map((tool) =>
              tool.href ? (
                <a
                  key={tool.label}
                  href={tool.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition-transform hover:-translate-y-0.5 hover:bg-white/10"
                >
                  <span className="text-2xl">{tool.icon}</span>
                  <span className="text-xs text-slate-300">{tool.label}</span>
                </a>
              ) : (
                <button
                  key={tool.label}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition-transform hover:-translate-y-0.5 hover:bg-white/10"
                >
                  <span className="text-2xl">{tool.icon}</span>
                  <span className="text-xs text-slate-300">{tool.label}</span>
                </button>
              )
            )}
          </div>

          {/* ملفات الأرشفة (بقفل) */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300">🔒 ملفات الأرشفة</h3>
              <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                لا حذف إلا بموافقة المدير
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {["أرشيف العقود 2025", "أرشيف الفواتير Q1", "مستندات المنشأة"].map((f) => (
                <li key={f} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
                  <span>📄 {f}</span>
                  <span className="text-xs text-slate-500">مقفل</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* العمود الأيسر — المهام والمرتجعات */}
        <div className="order-2 space-y-4 lg:order-3">
          <Panel title={`المهام اليومية (${DAILY_TASKS.filter((t) => !t.done).length})`}>
            <ul className="space-y-2">
              {DAILY_TASKS.map((t) => (
                <li key={t.t} className="flex items-start gap-2 text-sm">
                  <span className={t.done ? "text-emerald-400" : "text-slate-500"}>
                    {t.done ? "☑" : "☐"}
                  </span>
                  <span className={t.done ? "text-slate-500 line-through" : "text-slate-200"}>{t.t}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={`المعاملات المرتجعة (${RETURNED.length})`}>
            <ul className="space-y-2">
              {RETURNED.map((r) => (
                <li key={r.t} className="rounded-lg bg-black/20 p-2 text-sm">
                  <div className="text-slate-200">{r.t}</div>
                  <div className="text-xs text-amber-300">أولوية: {r.p}</div>
                </li>
              ))}
            </ul>
          </Panel>

          {/* مذكّرة صفراء */}
          <div className="rounded-2xl bg-yellow-200 p-4 text-sm text-yellow-900 shadow-lg">
            <div className="font-bold">📌 مذكرة</div>
            <p className="mt-1">اجتماع الإدارة المالية الساعة 1 ظهراً. تجهيز تقرير المتأخرات.</p>
          </div>

          {/* حالة الحساب */}
          <Panel title="حالة الحساب والخدمة">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">الخدمة</span>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                نشطة
              </span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}
