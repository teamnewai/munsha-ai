"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { DEPARTMENTS as DEPT_CATALOG } from "@/lib/deptMeta";
import type { DeptKey } from "@/lib/deptMeta";
import { toast } from "@/lib/toast";
import {
  generateStructurePreview, provisionOrgStructure, getProvisionStatus,
  type StructurePreview, type ProvisionResult,
} from "@/app/actions/provision";
import {
  Database, Sparkles, Network, CheckCircle2, Building2, Users, Bot, KeyRound,
  FileText, Workflow, BarChart3, ClipboardList, Check, ArrowLeft, LayoutDashboard, Loader2, AlertTriangle,
} from "lucide-react";

const STEPS = ["جمع البيانات", "تحليل AI", "الهيكل المقترح", "الإنشاء التلقائي"];

export default function OrgBuilderPage() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<DeptKey[]>(DEPT_CATALOG.map((d) => d.key));
  const [busy, setBusy] = useState(false);

  // بيانات المنشأة
  const [activity, setActivity] = useState("");
  const [clientType, setClientType] = useState("شركة");
  const [country, setCountry] = useState("السعودية");
  const [headcount, setHeadcount] = useState<number | "">("");

  const [preview, setPreview] = useState<StructurePreview | null>(null);
  const [result, setResult] = useState<ProvisionResult["summary"] | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [alreadyProvisioned, setAlreadyProvisioned] = useState(false);

  useEffect(() => {
    getProvisionStatus().then((s) => {
      if (s.ok) { setIsOwner(s.isOwner); setAlreadyProvisioned(s.provisioned); }
    });
  }, []);

  function toggleDept(k: DeptKey) {
    setSelected((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  async function runAnalysis() {
    if (selected.length === 0) { toast.error("اختر إدارة واحدة على الأقل"); return; }
    setBusy(true);
    const res = await generateStructurePreview({
      deptKeys: selected, activity: activity.trim() || undefined,
      clientType, country, headcount: typeof headcount === "number" ? headcount : undefined,
    });
    setBusy(false);
    if (!res.ok || !res.preview) { toast.error(res.error || "تعذّر توليد الهيكل"); return; }
    setPreview(res.preview);
    setStep(2);
  }

  async function approveAndGenerate() {
    setBusy(true);
    const res = await provisionOrgStructure({
      deptKeys: selected, activity: activity.trim() || undefined,
      clientType, country, headcount: typeof headcount === "number" ? headcount : undefined,
    });
    setBusy(false);
    if (!res.ok || !res.summary) { toast.error(res.error || "تعذّر إنشاء الهيكل"); return; }
    setResult(res.summary);
    setStep(3);
    toast.success("تم اعتماد الهيكل وإنشاء جميع المكاتب واللوحات تلقائياً");
  }

  return (
    <section className="space-y-6 p-6 md:p-8" dir="rtl">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center"><Sparkles className="size-5" /></span>
        <div>
          <h1 className="font-display text-2xl font-semibold">بناء المنشأة</h1>
          <p className="text-sm text-muted-foreground">من اعتماد الهيكل التنظيمي تُنشأ جميع المكاتب واللوحات والصلاحيات تلقائياً في قاعدة البيانات.</p>
        </div>
      </div>

      {alreadyProvisioned && step === 0 && (
        <Card className="mulki-card p-4 border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
          <p className="text-sm flex-1">منشأتك مبنيّة بالفعل. يمكنك إعادة التوليد لإضافة إدارات جديدة (لن تُحذف بياناتك الحالية)، أو الانتقال إلى <Link href="/offices" className="text-primary underline">المكاتب واللوحات</Link>.</p>
        </Card>
      )}

      {!isOwner && (
        <Card className="mulki-card p-4 border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
          <AlertTriangle className="size-5 text-amber-500 shrink-0" />
          <p className="text-sm">يمكنك معاينة الهيكل المقترح، لكن اعتماده وإنشاءه يتطلب صلاحية مالك أو مدير المنشأة.</p>
        </Card>
      )}

      {/* مؤشر الخطوات */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-3 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 sm:gap-3">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border ${
              i < step ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : i === step ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-background/40 text-muted-foreground"}`}>
              <span className="grid size-4 place-items-center rounded-full bg-current/20 text-[10px]">{i < step ? "✓" : i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <span className="text-muted-foreground text-xs">—</span>}
          </div>
        ))}
      </div>

      {/* الخطوة ١: البيانات */}
      {step === 0 && (
        <Card className="mulki-card p-6 max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2 text-primary"><Database className="size-5" /><h2 className="font-display font-semibold">جمع بيانات المنشأة</h2></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-muted-foreground">نشاط المنشأة</span>
              <Input className="mt-1" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="مثال: خدمات عقارية وإدارة أملاك" /></label>
            <label className="block"><span className="text-xs text-muted-foreground">نوع المنشأة</span>
              <select className="mulki-input mt-1 w-full" value={clientType} onChange={(e) => setClientType(e.target.value)}><option>شركة</option><option>مؤسسة</option><option>مكتب</option></select></label>
            <label className="block"><span className="text-xs text-muted-foreground">الدولة</span>
              <select className="mulki-input mt-1 w-full" value={country} onChange={(e) => setCountry(e.target.value)}><option>السعودية</option><option>الإمارات</option><option>الكويت</option><option>قطر</option><option>البحرين</option><option>عُمان</option></select></label>
            <label className="block"><span className="text-xs text-muted-foreground">عدد الموظفين (تقديري)</span>
              <Input className="mt-1" type="number" value={headcount} onChange={(e) => setHeadcount(e.target.value ? Number(e.target.value) : "")} placeholder="مثال: 50" /></label>
          </div>
          <div className="flex justify-end"><Button onClick={() => setStep(1)}>التالي: تحليل AI ←</Button></div>
        </Card>
      )}

      {/* الخطوة ٢: تحليل */}
      {step === 1 && (
        <Card className="mulki-card p-8 max-w-2xl mx-auto text-center space-y-4">
          <div className="size-16 mx-auto rounded-2xl bg-primary/15 text-primary grid place-items-center"><Sparkles className="size-8" /></div>
          <h2 className="font-display font-semibold">تحليل احتياجات المنشأة</h2>
          <p className="text-sm text-muted-foreground">اختر الإدارات المناسبة لنشاطك. لكل إدارة يُولَّد هيكل كامل: أقسام، مسميات وظيفية بواجباتها وصلاحياتها ومؤشراتها، موظفون ووكلاء ذكاء اصطناعي، نماذج ودورات مستندية.</p>
          <div className="grid sm:grid-cols-2 gap-2 text-start">
            {DEPT_CATALOG.map((g) => {
              const on = selected.includes(g.key);
              return (
                <button key={g.key} onClick={() => toggleDept(g.key)}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${on ? "border-primary/50 bg-primary/5" : "border-border bg-background/40 opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                    <span className="text-sm font-medium">{g.name}</span>
                  </div>
                  <span className={`size-5 rounded-full grid place-items-center ${on ? "bg-primary text-primary-foreground" : "border border-border"}`}>{on && <Check className="size-3" />}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>رجوع</Button>
            <Button onClick={runAnalysis} disabled={busy || selected.length === 0}>
              {busy ? <><Loader2 className="size-4 animate-spin ms-2" />جارٍ التحليل…</> : "توليد الهيكل المقترح ←"}
            </Button>
          </div>
        </Card>
      )}

      {/* الخطوة ٣: مراجعة الهيكل المقترح */}
      {step === 2 && preview && (
        <Card className="mulki-card p-6 max-w-4xl mx-auto space-y-5">
          <div className="flex items-center gap-2 text-primary"><Network className="size-5" /><h2 className="font-display font-semibold">الهيكل التنظيمي المقترح — راجِع واعتمد</h2></div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi icon={Building2} label="إدارات" value={preview.totals.depts} />
            <Kpi icon={Network} label="أقسام" value={preview.totals.sections} />
            <Kpi icon={ClipboardList} label="مسميات وظيفية" value={preview.totals.roles} />
            <Kpi icon={Users} label="موظفون" value={preview.totals.humans} />
            <Kpi icon={Bot} label="وكلاء AI" value={preview.totals.ai} />
            <Kpi icon={KeyRound} label="صلاحيات" value={preview.totals.permissions} />
            <Kpi icon={FileText} label="نماذج" value={preview.totals.forms} />
            <Kpi icon={Workflow} label="سير عمل" value={preview.totals.workflows} />
            <Kpi icon={BarChart3} label="مؤشرات أداء" value={preview.totals.kpis} />
            <Kpi icon={LayoutDashboard} label="لوحات ومكاتب" value={preview.totals.offices} />
          </div>

          <div className="space-y-2">
            {preview.depts.map((d) => (
              <div key={d.key} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{d.mission}</div>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                  <span>{d.sectionCount} قسم</span><span>{d.roleCount} وظيفة</span><span>{d.aiCount} وكيل</span><span>{d.formCount} نموذج</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>رجوع</Button>
            <Button disabled={busy || !isOwner} onClick={approveAndGenerate}>
              {busy ? <><Loader2 className="size-4 animate-spin ms-2" />جارٍ الإنشاء التلقائي…</> : "اعتماد الهيكل وبدء الإنشاء ✓"}
            </Button>
          </div>
        </Card>
      )}

      {/* الخطوة ٤: نتيجة الإنشاء التلقائي */}
      {step === 3 && result && (
        <div className="space-y-5 max-w-4xl mx-auto">
          <Card className="mulki-card p-6 text-center">
            <CheckCircle2 className="size-14 mx-auto text-emerald-400" />
            <h2 className="mt-3 font-display text-xl font-semibold">تم اعتماد الهيكل والإنشاء التلقائي الكامل</h2>
            <p className="text-sm text-muted-foreground mt-1">أُنشئت جميع الإدارات والأقسام والمسميات الوظيفية والمكاتب ولوحات التحكم والصلاحيات والنماذج وسير العمل في قاعدة البيانات.</p>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ResultCard icon={Building2} label="إدارة" value={result.departments} />
            <ResultCard icon={Network} label="قسم" value={result.sections} />
            <ResultCard icon={ClipboardList} label="مسمى وظيفي" value={result.roles} />
            <ResultCard icon={Users} label="مكتب موظف" value={result.humanOffices} />
            <ResultCard icon={Bot} label="مكتب وكيل AI" value={result.aiOffices} />
            <ResultCard icon={KeyRound} label="صلاحية" value={result.permissions} />
            <ResultCard icon={FileText} label="نموذج" value={result.forms} />
            <ResultCard icon={Workflow} label="سير عمل" value={result.workflows} />
            <ResultCard icon={BarChart3} label="مؤشر أداء" value={result.kpis} />
            <ResultCard icon={LayoutDashboard} label="لوحة/مكتب" value={result.dashboards} />
          </div>

          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/offices" className="rounded-xl mulki-gold-bg px-5 py-2.5 text-sm font-bold hover:opacity-90">المكاتب واللوحات المُنشأة</Link>
            <Link href="/org" className="rounded-xl border border-border px-5 py-2.5 text-sm">المخطط التنظيمي</Link>
            <Link href="/command-center" className="rounded-xl border border-border px-5 py-2.5 text-sm">لوحة القيادة</Link>
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3 text-center">
      <Icon className="size-4 mx-auto text-primary mb-1" />
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ResultCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return (
    <Card className="mulki-card p-4 flex flex-col items-center gap-1.5 text-center">
      <span className="size-10 rounded-lg bg-emerald-500/15 text-emerald-400 grid place-items-center"><Icon className="size-5" /></span>
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </Card>
  );
}
