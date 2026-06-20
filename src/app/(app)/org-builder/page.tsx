"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { DEPARTMENTS as DEPT_CATALOG } from "@/lib/deptMeta";
import { toast } from "@/lib/toast";

// كتالوج أنواع الإدارات (قالب توليد — ليست بيانات منشأة فعلية)
const CATALOG = DEPT_CATALOG.map((d) => ({ deptKey: d.key, deptName: d.name, color: d.color }));
import {
  Database, Sparkles, Network, CheckCircle2, Building2, Users, Bot, KeyRound,
  FileText, Workflow, BarChart3, ClipboardList, Check, ArrowLeft, LayoutDashboard,
} from "lucide-react";

const STEPS = ["جمع البيانات", "تحليل AI", "الهيكل المقترح", "الإنشاء التلقائي"];

const GENERATED = [
  { Icon: Building2, label: "جميع الإدارات" },
  { Icon: Network, label: "جميع الأقسام" },
  { Icon: ClipboardList, label: "جميع الوظائف" },
  { Icon: Users, label: "جميع الموظفين" },
  { Icon: Bot, label: "جميع وكلاء AI" },
  { Icon: KeyRound, label: "جميع الصلاحيات" },
  { Icon: BarChart3, label: "مؤشرات الأداء" },
  { Icon: FileText, label: "النماذج والدورات" },
  { Icon: Workflow, label: "سير العمل والاعتمادات" },
  { Icon: LayoutDashboard, label: "المكاتب ولوحات التحكم" },
];

export default function OrgBuilderPage() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(CATALOG.map((g) => g.deptKey));
  const [generating, setGenerating] = useState(false);

  const counts = { depts: selected.length };

  function toggleDept(k: string) {
    setSelected((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  function approveAndGenerate() {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setStep(3); toast.success("تم اعتماد الهيكل وإنشاء جميع المكاتب واللوحات تلقائياً"); }, 1400);
  }

  return (
    <section className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center"><Sparkles className="size-5" /></span>
        <div>
          <h1 className="font-display text-2xl font-semibold">بناء المنشأة</h1>
          <p className="text-sm text-muted-foreground">من اعتماد الهيكل التنظيمي تُنشأ جميع المكاتب واللوحات والصلاحيات تلقائياً.</p>
        </div>
      </div>

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
            <label className="block"><span className="text-xs text-muted-foreground">نشاط المنشأة</span><Input className="mt-1" defaultValue="خدمات عقارية وإدارة أملاك" /></label>
            <label className="block"><span className="text-xs text-muted-foreground">نوع المنشأة</span>
              <select className="mulki-input mt-1"><option>شركة</option><option>مؤسسة</option><option>مكتب</option></select></label>
            <label className="block"><span className="text-xs text-muted-foreground">الدولة</span>
              <select className="mulki-input mt-1"><option>السعودية</option><option>الإمارات</option><option>الكويت</option></select></label>
            <label className="block"><span className="text-xs text-muted-foreground">عدد الموظفين</span><Input className="mt-1" type="number" defaultValue={156} /></label>
          </div>
          <div className="flex justify-end"><Button onClick={() => setStep(1)}>التالي: تحليل AI ←</Button></div>
        </Card>
      )}

      {/* الخطوة ٢: تحليل */}
      {step === 1 && (
        <Card className="mulki-card p-8 max-w-2xl mx-auto text-center space-y-4">
          <div className="size-16 mx-auto rounded-2xl bg-primary/15 text-primary grid place-items-center"><Sparkles className="size-8" /></div>
          <h2 className="font-display font-semibold">تحليل نور AI لاحتياجات المنشأة</h2>
          <p className="text-sm text-muted-foreground">يحلّل النظام نشاطك وحجمك ليقترح هيكلاً تنظيمياً مناسباً (إدارات، أقسام، وظائف، وكلاء، صلاحيات).</p>
          <ul className="text-sm text-muted-foreground space-y-1 text-start max-w-sm mx-auto">
            <li>✓ تحديد الإدارات الأساسية لنشاطك</li>
            <li>✓ اقتراح الأقسام والوظائف</li>
            <li>✓ توزيع الصلاحيات ومؤشرات الأداء</li>
          </ul>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>رجوع</Button>
            <Button onClick={() => setStep(2)}>توليد الهيكل المقترح ←</Button>
          </div>
        </Card>
      )}

      {/* الخطوة ٣: مراجعة الهيكل المقترح */}
      {step === 2 && (
        <Card className="mulki-card p-6 max-w-3xl mx-auto space-y-4">
          <div className="flex items-center gap-2 text-primary"><Network className="size-5" /><h2 className="font-display font-semibold">الهيكل التنظيمي المقترح — راجِع واعتمد</h2></div>
          <p className="text-xs text-muted-foreground">فعّل/عطّل أي إدارة. عند الاعتماد تُنشأ مكاتب ولوحات وصلاحيات كل العناصر تلقائياً.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {CATALOG.map((g) => {
              const on = selected.includes(g.deptKey);
              return (
                <button key={g.deptKey} onClick={() => toggleDept(g.deptKey)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-start transition-colors ${on ? "border-primary/50 bg-primary/5" : "border-border bg-background/40 opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                    <div>
                      <div className="text-sm font-medium">{g.deptName}</div>
                    </div>
                  </div>
                  <span className={`size-5 rounded-full grid place-items-center ${on ? "bg-primary text-primary-foreground" : "border border-border"}`}>{on && <Check className="size-3" />}</span>
                </button>
              );
            })}
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3 text-sm flex items-center justify-center">
            <span>{counts.depts} إدارة مختارة للتوليد</span>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>رجوع</Button>
            <Button disabled={counts.depts === 0 || generating} onClick={approveAndGenerate}>
              {generating ? "جارٍ الإنشاء التلقائي…" : "اعتماد الهيكل وبدء الإنشاء ✓"}
            </Button>
          </div>
        </Card>
      )}

      {/* الخطوة ٤: نتيجة الإنشاء التلقائي */}
      {step === 3 && (
        <div className="space-y-5">
          <Card className="mulki-card p-6 text-center">
            <CheckCircle2 className="size-14 mx-auto text-emerald-400" />
            <h2 className="mt-3 font-display text-xl font-semibold">تم اعتماد الهيكل والإنشاء التلقائي الكامل</h2>
            <p className="text-sm text-muted-foreground mt-1">أُنشئت جميع المكاتب ولوحات التحكم والصلاحيات والعمليات المرتبطة بالهيكل.</p>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {GENERATED.map((g) => (
              <Card key={g.label} className="mulki-card p-4 flex flex-col items-center gap-2 text-center">
                <span className="size-10 rounded-lg bg-emerald-500/15 text-emerald-400 grid place-items-center"><g.Icon className="size-5" /></span>
                <span className="text-xs">{g.label}</span>
                <Check className="size-3.5 text-emerald-400" />
              </Card>
            ))}
          </div>

          <div>
            <h3 className="font-display text-sm uppercase tracking-[0.18em] text-muted-foreground mb-3">المكاتب المُنشأة — ادخل أيّاً منها</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CATALOG.filter((g) => selected.includes(g.deptKey)).map((g) => (
                <Link key={g.deptKey} href="/org"
                  className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 hover:border-primary/50 transition-colors">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                  <h4 className="flex-1 text-sm font-semibold truncate">{g.deptName}</h4>
                  <ArrowLeft className="size-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Link href="/command-center" className="rounded-xl mulki-gold-bg px-5 py-2.5 text-sm font-bold hover:opacity-90">الذهاب للوحة القيادة</Link>
            <button onClick={() => setStep(0)} className="rounded-xl border border-border px-5 py-2.5 text-sm">إعادة البناء</button>
          </div>
        </div>
      )}
    </section>
  );
}
