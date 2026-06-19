"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CITIES_BY_COUNTRY } from "@/lib/activities";
import { ISIC4_SECTIONS, isicSubByCode } from "@/lib/isic4";
import { generateStructure, type GeneratedStructure } from "@/lib/orgGenerator";
import { Button } from "@/components/ui/Button";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const COUNTRIES: { code: string; name: string }[] = [
  { code: "SA", name: "السعودية" },
  { code: "AE", name: "الإمارات" },
  { code: "KW", name: "الكويت" },
  { code: "BH", name: "البحرين" },
  { code: "QA", name: "قطر" },
  { code: "OM", name: "عُمان" },
];

const CLIENT_TYPES: { v: string; l: string }[] = [
  { v: "company", l: "شركة" },
  { v: "office", l: "مكتب" },
  { v: "owner", l: "مالك" },
  { v: "provider", l: "مزوّد خدمة" },
  { v: "marketer", l: "مسوّق" },
  { v: "community", l: "اتحاد ملاك" },
  { v: "serviced", l: "شقق مخدومة" },
];

type EmpRow = { full_name: string; email: string; job_title: string; dept_key: string; section: string };

const emptyRow = (dept_key = ""): EmpRow => ({ full_name: "", email: "", job_title: "", dept_key, section: "" });

/** مطابقة ذكية لرؤوس أعمدة الإكسل (عربي/إنجليزي) */
function pickHeader(headers: string[], candidates: string[]): string | null {
  const norm = (s: string) => s.toString().trim().toLowerCase().replace(/[ً-ْ_\s]/g, "");
  for (const h of headers) {
    const nh = norm(h);
    if (candidates.some((c) => nh.includes(norm(c)))) return h;
  }
  return null;
}

/** تحويل صفوف الإكسل إلى موظفين + مطابقة الإدارة بالاسم/المفتاح */
function rowsToEmployees(
  rows: Record<string, unknown>[],
  depts: { key: string; name: string }[]
): EmpRow[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const hName = pickHeader(headers, ["full_name", "name", "الاسم", "اسم", "الموظف"]);
  const hEmail = pickHeader(headers, ["email", "mail", "البريد", "الايميل", "بريد"]);
  const hJob = pickHeader(headers, ["job_title", "title", "job", "المسمى", "الوظيفة", "المنصب"]);
  const hDept = pickHeader(headers, ["dept", "department", "الإدارة", "الادارة", "القسم"]);
  const hSection = pickHeader(headers, ["section", "الشعبة", "القسمالفرعي"]);
  const matchDept = (val: unknown): string => {
    const v = (val ?? "").toString().trim().toLowerCase();
    if (!v) return "";
    const byKey = depts.find((d) => d.key.toLowerCase() === v);
    if (byKey) return byKey.key;
    const byName = depts.find((d) => d.name.toLowerCase().includes(v) || v.includes(d.name.toLowerCase()));
    return byName ? byName.key : "";
  };
  return rows
    .map((r) => ({
      full_name: hName ? String(r[hName] ?? "").trim() : "",
      email: hEmail ? String(r[hEmail] ?? "").trim() : "",
      job_title: hJob ? String(r[hJob] ?? "").trim() : "",
      dept_key: hDept ? matchDept(r[hDept]) : "",
      section: hSection ? String(r[hSection] ?? "").trim() : "",
    }))
    .filter((e) => e.full_name);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // الخطوة 1
  const [method, setMethod] = useState<"mulki" | "monshaati">("monshaati");
  // الخطوة 2
  const [name, setName] = useState("");
  // الأنشطة (ISIC4): رئيسي/فرعي + إمكانية إضافة أكثر من نشاط
  const defaultSection = ISIC4_SECTIONS.find((s) => s.code === "L") ?? ISIC4_SECTIONS[0];
  const [activities, setActivities] = useState<{ section: string; sub: string }[]>([
    { section: defaultSection.code, sub: defaultSection.subs[0].code },
  ]);
  const primaryBase = isicSubByCode(activities[0]?.sub)?.sub.base ?? "services";
  const extraBases = activities.slice(1)
    .map((a) => isicSubByCode(a.sub)?.sub.base)
    .filter((b): b is string => Boolean(b));
  const activity = primaryBase; // توافقاً مع التوليد والحفظ
  const activitiesDetail = activities.map((a) => {
    const r = isicSubByCode(a.sub);
    return { section: a.section, code: a.sub, name: r?.sub.name ?? null, base: r?.sub.base ?? null };
  });
  const [employees, setEmployees] = useState(20);
  const [country, setCountry] = useState("SA");
  const [city, setCity] = useState(CITIES_BY_COUNTRY["SA"][0]);
  const [clientType, setClientType] = useState("company");
  // نوع التشغيل: بشري 100% · هجين (بنسبة) · AI 100%
  const [operationType, setOperationType] = useState<"human" | "hybrid" | "ai">("hybrid");
  const [aiRatio, setAiRatio] = useState(40);
  // الخطوة 3
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [approved, setApproved] = useState(false); // بوابة اعتماد المالك (إلزامية)

  // الخطوة الموظفون (الفعليون) — يدوي أو رفع إكسل
  const [empMode, setEmpMode] = useState<"manual" | "excel">("manual");
  const [empList, setEmpList] = useState<EmpRow[]>([]);
  const [empNote, setEmpNote] = useState<string | null>(null);

  const structure: GeneratedStructure | null = useMemo(
    () => (step >= 3 ? generateStructure(primaryBase, employees, extraBases) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, primaryBase, employees, JSON.stringify(extraBases)]
  );

  // محرّرات الأنشطة
  function setActivityRow(i: number, patch: Partial<{ section: string; sub: string }>) {
    setActivities((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function changeSection(i: number, sectionCode: string) {
    const sec = ISIC4_SECTIONS.find((s) => s.code === sectionCode);
    setActivityRow(i, { section: sectionCode, sub: sec?.subs[0].code ?? "" });
  }
  function addActivity() {
    const s = ISIC4_SECTIONS[0];
    setActivities((rows) => [...rows, { section: s.code, sub: s.subs[0].code }]);
  }
  function removeActivity(i: number) {
    setActivities((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));
  }

  const cities = CITIES_BY_COUNTRY[country] ?? [];

  const deptOptions = useMemo(
    () => (structure?.departments ?? []).map((d) => ({ key: d.key, name: d.name })),
    [structure]
  );

  // تعبئة صفوف أولية عند دخول خطوة الموظفين
  function ensureSeed() {
    if (empList.length === 0) {
      const firstDept = deptOptions[0]?.key ?? "";
      const n = Math.min(Math.max(employees, 1), 5);
      setEmpList(Array.from({ length: n }, () => emptyRow(firstDept)));
    }
  }

  // قراءة ملف الإكسل وتعبئة الموظفين تلقائياً
  async function onExcel(file: File) {
    setEmpNote(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const parsed = rowsToEmployees(rows, deptOptions);
      if (parsed.length === 0) {
        setEmpNote("لم نتعرّف على بيانات موظفين في الملف. تأكّد من وجود عمود للاسم (مثل: الاسم / name).");
        return;
      }
      setEmpList(parsed);
      setEmpMode("excel");
      setEmpNote(`✅ تمت قراءة ${parsed.length} موظفاً من الملف — راجِعها وعدّلها قبل البناء.`);
    } catch {
      setEmpNote("تعذّرت قراءة الملف. استخدم صيغة .xlsx أو .csv.");
    }
  }

  function updateEmp(i: number, patch: Partial<EmpRow>) {
    setEmpList((list) => list.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  async function finish() {
    setErr(null);
    setSaving(true);

    // إنشاء منشأة حقيقية عبر دالة onboard_org (SECURITY DEFINER) — تنشئ المنشأة + العضوية.
    if (isSupabaseConfigured()) {
      const supabase = createClient()!;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.rpc("onboard_org", {
          p_name: name.trim(),
          p_client_type: clientType,
          p_country: country,
          p_region: null,
          p_city: city || null,
        });
        if (error) {
          setSaving(false);
          setErr("تعذّر إنشاء المنشأة: " + error.message);
          return;
        }

        // تثبيت الهيكل المولّد بعد اعتماد المالك:
        // org_structure_docs + approvals + org_departments/org_sections/org_roles
        if (structure) {
          const { data: gen, error: genErr } = await supabase.rpc("generate_org", {
            p_input: {
              name, activity, activities: activitiesDetail, employees, country, city, clientType,
              operation_type: operationType, ai_ratio: operationType === "hybrid" ? aiRatio : operationType === "ai" ? 100 : 0,
            },
            p_structure: structure,
            p_source: method === "mulki" ? "local" : "ai",
            p_employees: empList.filter((e) => e.full_name.trim()),
          });
          const g = gen as { ok?: boolean; reason?: string } | null;
          if (genErr || (g && g.ok === false)) {
            setSaving(false);
            setErr("تعذّر بناء الهيكل: " + (genErr?.message ?? g?.reason ?? "خطأ غير معروف"));
            return;
          }
        }
      }
    }

    // حفظ نتيجة المولّد محلياً لعرضها في صفحة الهيكل
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
            { n: 3, t: "الموظفون" },
            { n: 4, t: "الهيكل والاعتماد" },
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
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-fg">الأنشطة (ISIC4) — رئيسي وفرعي</label>
                <div className="space-y-2">
                  {activities.map((row, i) => {
                    const sec = ISIC4_SECTIONS.find((s) => s.code === row.section) ?? ISIC4_SECTIONS[0];
                    return (
                      <div key={i} className="grid gap-2 rounded-xl border border-line bg-card2/30 p-2 sm:grid-cols-[1fr_1fr_auto]">
                        {/* النشاط الرئيسي (القطاع) */}
                        <select value={row.section} onChange={(e) => changeSection(i, e.target.value)} className={inputCls}>
                          {ISIC4_SECTIONS.map((s) => (
                            <option key={s.code} value={s.code} className={optCls}>
                              {s.icon} {s.code} — {s.name}
                            </option>
                          ))}
                        </select>
                        {/* النشاط الفرعي */}
                        <select value={row.sub} onChange={(e) => setActivityRow(i, { sub: e.target.value })} className={inputCls}>
                          {sec.subs.map((sub) => (
                            <option key={sub.code} value={sub.code} className={optCls}>
                              {sub.code} — {sub.name}
                            </option>
                          ))}
                        </select>
                        {/* حذف الصف */}
                        {activities.length > 1 ? (
                          <button type="button" onClick={() => removeActivity(i)} title="حذف النشاط"
                            className="rounded-xl border border-line px-3 text-bad hover:bg-bad/10">✕</button>
                        ) : <span />}
                        {i === 0 && <span className="text-[11px] text-mut sm:col-span-3">النشاط الأول هو الرئيسي ويقود توليد الهيكل؛ الأنشطة الإضافية تضيف إداراتها المقترحة.</span>}
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={addActivity}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/5 px-3 py-1.5 text-xs font-bold text-gold hover:bg-gold/10">
                  ＋ إضافة نشاط آخر
                </button>
              </div>
              <Field label="نوع المنشأة">
                <select value={clientType} onChange={(e) => setClientType(e.target.value)} className={inputCls}>
                  {CLIENT_TYPES.map((c) => (
                    <option key={c.v} value={c.v} className={optCls}>
                      {c.l}
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
                    <option key={c.code} value={c.code} className={optCls}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="المدينة">
                <select value={city} onChange={(e) => setCity(e.target.value)} className={inputCls}>
                  {cities.map((c) => (
                    <option key={c} value={c} className={optCls}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-fg">نوع التشغيل</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "human", l: "بشري 100%", icon: "👤", d: "الموظفون فقط" },
                    { v: "hybrid", l: "هجين", icon: "🤝", d: "بشر + وكلاء AI" },
                    { v: "ai", l: "AI 100%", icon: "🤖", d: "وكلاء ذكاء" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setOperationType(o.v as "human" | "hybrid" | "ai")}
                      className={`rounded-xl border p-3 text-center transition-colors ${
                        operationType === o.v ? "border-gold bg-gold/10" : "border-line hover:bg-card2"
                      }`}
                    >
                      <div className="text-xl">{o.icon}</div>
                      <div className="mt-1 text-sm font-bold text-fg">{o.l}</div>
                      <div className="text-[11px] text-mut">{o.d}</div>
                    </button>
                  ))}
                </div>
                {operationType === "hybrid" && (
                  <div className="mt-3 rounded-xl border border-line bg-card2/40 p-3">
                    <div className="flex items-center justify-between text-xs text-mut">
                      <span>بشري {100 - aiRatio}%</span>
                      <span className="font-bold text-gold">نسبة الذكاء الاصطناعي: {aiRatio}%</span>
                    </div>
                    <input
                      type="range" min={0} max={100} step={10}
                      value={aiRatio}
                      onChange={(e) => setAiRatio(Number(e.target.value))}
                      className="mt-2 w-full accent-[var(--gold,#caa53d)]"
                    />
                  </div>
                )}
              </div>
            </div>
            <Nav
              onBack={() => setStep(1)}
              onNext={() => {
                ensureSeed();
                setStep(3);
              }}
              nextLabel="توليد الهيكل"
              nextDisabled={!name.trim()}
            />
          </Card>
        )}

        {/* الخطوة 3 — الموظفون الفعليون (يدوي أو رفع إكسل) */}
        {step === 3 && (
          <Card>
            <H>بيانات الموظفين الفعليين</H>
            <p className="mt-2 text-sm text-mut">
              عدد الموظفين المحدّد: <span className="font-bold text-fg">{employees}</span>. أدخل البيانات
              يدوياً أو ارفع ملف إكسل ليُقرأ ويُبنى على أساسه. (اختياري — يمكنك إضافتهم لاحقاً.)
            </p>

            {/* مبدّل الطريقة */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Choice
                active={empMode === "manual"}
                onClick={() => setEmpMode("manual")}
                icon="✍️"
                title="إدخال يدوي"
                desc="أدخل الموظفين صفاً صفاً مع إدارة كل موظف."
              />
              <Choice
                active={empMode === "excel"}
                onClick={() => setEmpMode("excel")}
                icon="📊"
                title="تحميل من إكسل"
                desc="ارفع ملف .xlsx/.csv ونقرأه تلقائياً (الاسم، البريد، المسمى، الإدارة)."
              />
            </div>

            {empMode === "excel" && (
              <div className="mt-4 rounded-2xl border border-dashed border-line bg-card2/50 p-5 text-center">
                <input
                  id="emp-excel"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onExcel(f);
                  }}
                />
                <label
                  htmlFor="emp-excel"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-golddark hover:opacity-90"
                >
                  📤 اختر ملف الإكسل
                </label>
                <p className="mt-2 text-xs text-mut">
                  أعمدة مدعومة: الاسم / name · البريد / email · المسمى / job_title · الإدارة / department
                </p>
              </div>
            )}

            {empNote && <p className="mt-3 text-sm text-fg">{empNote}</p>}

            {/* جدول الموظفين القابل للتعديل */}
            {empList.length > 0 && (
              <div className="mt-5 space-y-2">
                {empList.map((emp, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-card p-3 sm:grid-cols-12">
                    <input
                      className={`${inputCls} sm:col-span-3`}
                      placeholder="الاسم"
                      value={emp.full_name}
                      onChange={(e) => updateEmp(i, { full_name: e.target.value })}
                    />
                    <input
                      className={`${inputCls} sm:col-span-3`}
                      placeholder="البريد (اختياري)"
                      value={emp.email}
                      onChange={(e) => updateEmp(i, { email: e.target.value })}
                    />
                    <input
                      className={`${inputCls} sm:col-span-3`}
                      placeholder="المسمى الوظيفي"
                      value={emp.job_title}
                      onChange={(e) => updateEmp(i, { job_title: e.target.value })}
                    />
                    <select
                      className={`${inputCls} sm:col-span-2`}
                      value={emp.dept_key}
                      onChange={(e) => updateEmp(i, { dept_key: e.target.value })}
                    >
                      <option value="" className={optCls}>— الإدارة —</option>
                      {deptOptions.map((d) => (
                        <option key={d.key} value={d.key} className={optCls}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setEmpList((l) => l.filter((_, idx) => idx !== i))}
                      className="rounded-lg border border-line text-sm text-bad hover:bg-card2 sm:col-span-1"
                      title="حذف"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setEmpList((l) => [...l, emptyRow(deptOptions[0]?.key ?? "")])}
              className="mt-3 rounded-xl border border-line px-4 py-2 text-sm font-medium text-fg hover:bg-card2"
            >
              ＋ إضافة موظف
            </button>

            <Nav
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              nextLabel={empList.filter((e) => e.full_name.trim()).length > 0 ? "التالي" : "تخطٍّ — لاحقاً"}
            />
          </Card>
        )}

        {/* الخطوة 4 — معاينة الهيكل + الاعتماد */}
        {step === 4 && structure && (
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

            {/* معاينة هرمية واضحة قبل الاعتماد — المنشأة ← الإدارات ← الأقسام/المناصب */}
            <div className="mt-6 overflow-x-auto">
              {/* العقدة الجذر */}
              <div className="mx-auto w-fit rounded-2xl border-2 border-gold bg-gold/10 px-6 py-3 text-center shadow-sm">
                <div className="text-2xl">🏢</div>
                <div className="font-extrabold text-fg">{name || "منشأتك"}</div>
                <div className="text-[11px] text-mut">
                  {structure.deptCount} إدارة · {structure.sectionCount} قسم · {structure.roleCount} منصب
                </div>
              </div>

              {/* فروع الإدارات */}
              <div className="relative mt-4 mr-5 space-y-3 border-r-2 border-gold/30 pr-5">
                {structure.departments.map((d) => (
                  <div key={d.key} className="relative">
                    <span className="absolute -right-5 top-6 h-0.5 w-5 bg-gold/30" />
                    <div className="rounded-xl border border-line bg-card2/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-bold text-fg">
                          <span>{d.icon}</span>
                          {d.name}
                          {d.isCore && (
                            <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                              أساسي
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-mut">{d.roles.length} منصب · {d.sections.length} قسم</span>
                      </div>

                      {/* الأقسام الفرعية (تفرّع) */}
                      {d.sections.length > 0 && (
                        <div className="mt-2 mr-3 space-y-1 border-r border-line pr-3">
                          {d.sections.map((s) => (
                            <div key={s.name} className="relative flex items-center gap-1.5 text-xs text-mut">
                              <span className="absolute -right-3 top-1/2 h-px w-3 bg-line" />
                              <span className="text-gold">▸</span>
                              {s.name}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* المناصب */}
                      {d.roles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {d.roles.map((r) => (
                            <span key={r} className="rounded-full bg-card2 px-2.5 py-0.5 text-[11px] text-fg">
                              👤 {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* بوابة اعتماد المالك — إلزامية قبل أي بناء فعلي */}
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-gold/40 bg-gold/5 p-4">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-[var(--gold,#caa53d)]"
              />
              <span className="text-sm leading-relaxed text-fg">
                <span className="font-bold">أعتمد هذا البناء.</span>{" "}
                <span className="text-mut">
                  بصفتي المالك/المخوّل، أوافق على إنشاء الهيكل التنظيمي والإدارات والمناصب أعلاه. لن
                  يُنفّذ أي بناء فعلي قبل هذا الاعتماد.
                </span>
              </span>
            </label>

            {err && <p className="mt-4 text-sm text-bad">{err}</p>}

            <Nav
              onBack={() => setStep(3)}
              onNext={finish}
              nextLabel={saving ? "جارٍ بناء المنشأة..." : "اعتماد وفتح المكتب"}
              nextDisabled={saving || !approved}
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
// لون خيارات القوائم المنسدلة (إصلاح: كانت غير مقروءة — أبيض على أبيض)
const optCls = "bg-white text-slate-900";

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
