"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ACTIVITY_CATALOG, CITIES_BY_COUNTRY } from "@/lib/activities";
import { generateStructure, type GeneratedStructure } from "@/lib/orgGenerator";
import { Button } from "@/components/ui/Button";

const COUNTRIES: { code: string; name: string }[] = [
  { code: "SA", name: "السعودية" },
  { code: "AE", name: "الإمارات" },
  { code: "KW", name: "الكويت" },
  { code: "BH", name: "البحرين" },
  { code: "QA", name: "قطر" },
  { code: "OM", name: "عُمان" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // الخطوة 1
  const [method, setMethod] = useState<"mulki" | "monshaati">("monshaati");
  // الخطوة 2
  const [name, setName] = useState("");
  const [activity, setActivity] = useState(ACTIVITY_CATALOG[0].key);
  const [employees, setEmployees] = useState(20);
  const [country, setCountry] = useState("SA");
  const [city, setCity] = useState(CITIES_BY_COUNTRY["SA"][0]);
  const [enableAI, setEnableAI] = useState(true);
  // الخطوة 3
  const [saving, setSaving] = useState(false);

  const structure: GeneratedStructure | null = useMemo(
    () => (step >= 3 ? generateStructure(activity, employees) : null),
    [step, activity, employees]
  );

  const cities = CITIES_BY_COUNTRY[country] ?? [];

  async function finish() {
    setSaving(true);
    // ملاحظة أمان: لا نكتب إلى قاعدة البيانات الحقيقية من هذا المعالج حالياً
    // لتفادي إنشاء منشآت تجريبية في الإنتاج. الإنشاء الحقيقي يتم لاحقاً عبر مسارٍ
    // مخصّص مطابق للمخطّط الفعلي (organizations: client_type, country, city...).
    // المعاينة تُحفظ محلياً فقط (sessionStorage).
    // حفظ النتيجة محلياً لعرضها في صفحة الهيكل (مفيد في الوضع التجريبي)
    try {
      sessionStorage.setItem(
        "mulki_structure",
        JSON.stringify({ name, country, city, activity, structure })
      );
    } catch {
      /* تجاهل */
    }
    setSaving(false);
    router.push("/os/structure");
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* الترويسة */}
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold font-extrabold text-golddark">
              مُ
            </span>
            <span className="text-lg font-extrabold text-fg">مُلكي إدراك</span>
          </Link>
          <span className="text-sm text-mut">فتح المكتب</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* مؤشّر الخطوات */}
        <ol className="mb-10 flex items-center justify-center gap-2">
          {[
            { n: 1, t: "الطريقة" },
            { n: 2, t: "بيانات المنشأة" },
            { n: 3, t: "الهيكل المولّد" },
          ].map((s, i) => (
            <li key={s.n} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                  step >= s.n ? "bg-gold text-golddark" : "bg-card2 text-mut"
                }`}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-card/20 text-xs">
                  {s.n}
                </span>
                {s.t}
              </div>
              {i < 2 && <span className="h-px w-6 bg-card2" />}
            </li>
          ))}
        </ol>

        {/* الخطوة 1 — الطريقة */}
        {step === 1 && (
          <Card>
            <H>اختر طريقة بناء الهيكل</H>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Choice
                active={method === "monshaati"}
                onClick={() => setMethod("monshaati")}
                icon="🤖"
                title="نظام منشأتي AI"
                badge="موصى به"
                desc="توليد ذكي للهيكل التنظيمي مبني على أطر معيارية (COSO · OECD · RACI · Mintzberg)."
              />
              <Choice
                active={method === "mulki"}
                onClick={() => setMethod("mulki")}
                icon="🧬"
                title="مولّد مُلكي"
                desc="بناء الهيكل بنفسك عبر مولّد مُلكي المحلي — فوري ومجاني."
              />
            </div>
            <Nav onNext={() => setStep(2)} nextLabel="التالي" />
          </Card>
        )}

        {/* الخطوة 2 — بيانات المنشأة */}
        {step === 2 && (
          <Card>
            <H>بيانات المنشأة</H>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="اسم المنشأة">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: شركة الإدراك العقارية"
                  className={inputCls}
                />
              </Field>
              <Field label="النشاط (ISIC4)">
                <select value={activity} onChange={(e) => setActivity(e.target.value)} className={inputCls}>
                  {ACTIVITY_CATALOG.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.icon} {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="عدد الموظفين">
                <input
                  type="number"
                  min={1}
                  value={employees}
                  onChange={(e) => setEmployees(Math.max(1, Number(e.target.value)))}
                  className={inputCls}
                />
              </Field>
              <Field label="الدولة">
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setCity((CITIES_BY_COUNTRY[e.target.value] ?? [""])[0]);
                  }}
                  className={inputCls}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="المدينة">
                <select value={city} onChange={(e) => setCity(e.target.value)} className={inputCls}>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="وكلاء الذكاء للأدوار غير المموّلة">
                <label className="flex h-[42px] items-center gap-2 rounded-xl border border-line px-4">
                  <input type="checkbox" checked={enableAI} onChange={(e) => setEnableAI(e.target.checked)} />
                  <span className="text-sm text-mut">تفعيل (قيد التفعيل)</span>
                </label>
              </Field>
            </div>
            <Nav
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              nextLabel="توليد الهيكل"
              nextDisabled={!name.trim()}
            />
          </Card>
        )}

        {/* الخطوة 3 — معاينة الهيكل */}
        {step === 3 && structure && (
          <Card>
            <H>الهيكل المولّد</H>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="فئة الحجم" value={structure.scale} />
              <Stat label="الإدارات" value={String(structure.deptCount)} />
              <Stat label="الأقسام" value={String(structure.sectionCount)} />
              <Stat label="المناصب" value={String(structure.roleCount)} />
            </div>
            <p className="mt-3 text-sm text-mut">
              {structure.scaleLabel} · النموذج: {structure.model} · رقم الإصدار:{" "}
              <span className="font-mono font-bold text-gold">{structure.version}</span>
            </p>

            <div className="mt-6 space-y-3">
              {structure.departments.map((d) => (
                <div key={d.key} className="rounded-xl border border-line bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-fg">
                      <span>{d.icon}</span>
                      {d.name}
                      {d.isCore && (
                        <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                          أساسي
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-mut">{d.sections.length} أقسام</span>
                  </div>
                  {d.sections.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.sections.map((s) => (
                        <span
                          key={s.name}
                          className="rounded-full bg-card2 px-2.5 py-0.5 text-xs text-mut"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Nav
              onBack={() => setStep(2)}
              onNext={finish}
              nextLabel={saving ? "جارٍ فتح المكتب..." : "فتح المكتب والدخول"}
              nextDisabled={saving}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── عناصر مساعدة ── */
const inputCls =
  "w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">{children}</div>;
}
function H({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-extrabold text-fg">{children}</h1>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-fg">{label}</label>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gold/10 p-3 text-center">
      <div className="text-xl font-extrabold text-gold">{value}</div>
      <div className="text-xs text-mut">{label}</div>
    </div>
  );
}
function Choice({
  active,
  onClick,
  icon,
  title,
  desc,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-2xl border p-5 text-right transition-colors ${
        active ? "border-brand-500 bg-gold/10 ring-2 ring-brand-300" : "border-line hover:bg-card2"
      }`}
    >
      {badge && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold text-brand-950">
          {badge}
        </span>
      )}
      <div className="text-3xl">{icon}</div>
      <div className="mt-3 font-bold text-fg">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-mut">{desc}</p>
    </button>
  );
}
function Nav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          ← السابق
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}
