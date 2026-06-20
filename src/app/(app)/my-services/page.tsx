"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { CATEGORIES } from "@/lib/providers";
import { getOrgServices, saveOrgServices } from "@/app/actions/services";
import { ChevronDown, Check, Store, ExternalLink, Trash2 } from "lucide-react";

// خدماتي — تختار المنشأة خدماتها من قائمة منسدلة (نفس خدمات الصفحة الرئيسية)
// فتظهر كمزوّد في الصفحة الرئيسية ضمن تلك التصنيفات. (وضع تجريبي — تخزين محلي)

export default function MyServicesPage() {
  const [orgName, setOrgName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // تحميل الخدمات المحفوظة فعلياً من قاعدة البيانات (مع التراجع للتخزين المحلي)
    getOrgServices().then((r) => {
      if (r.ok) {
        if (r.orgName) setOrgName(r.orgName);
        setSelected(r.categories);
        return;
      }
      try {
        const raw = localStorage.getItem("mulki:my-services");
        if (raw) {
          const v = JSON.parse(raw);
          setOrgName(v.orgName ?? "");
          setSelected(Array.isArray(v.categories) ? v.categories : []);
        }
      } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    localStorage.setItem("mulki:my-services", JSON.stringify({ orgName, categories: selected }));
    const r = await saveOrgServices(selected);
    setSaving(false);
    if (r.ok) toast.success("تم حفظ خدماتك فعلياً — أصبحت منشأتك مزوّداً لهذه الخدمات");
    else toast.error(`تعذّر الحفظ في القاعدة: ${r.error ?? ""} (حُفظت محلياً)`);
  }

  const selectedCats = CATEGORIES.filter((c) => selected.includes(c.key));

  return (
    <section className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center"><Store className="size-5" /></span>
        <div>
          <h1 className="font-display text-2xl font-semibold">خدماتي</h1>
          <p className="text-sm text-muted-foreground">عرّف الخدمات التي تقدّمها منشأتك لتظهر كمزوّد في الصفحة الرئيسية.</p>
        </div>
      </div>

      <Card className="mulki-card p-6 space-y-5 max-w-2xl">
        <div>
          <label className="block text-sm font-medium mb-1.5">اسم المنشأة</label>
          <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="مثال: مكتب الرواد للاستشارات" />
        </div>

        {/* القائمة المنسدلة — نفس خدمات الصفحة الرئيسية */}
        <div ref={ref} className="relative">
          <label className="block text-sm font-medium mb-1.5">الخدمات التي تقدّمها</label>
          <button type="button" onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm hover:border-primary/50">
            <span className={selected.length ? "text-foreground" : "text-muted-foreground"}>
              {selected.length ? `${selected.length} خدمة مختارة` : "اختر من القائمة…"}
            </span>
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-2xl max-h-72 overflow-y-auto">
              {CATEGORIES.map((c) => {
                const on = selected.includes(c.key);
                return (
                  <button key={c.key} type="button" onClick={() => toggle(c.key)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-sidebar-accent/60 text-start">
                    <span className={`size-4 rounded border grid place-items-center ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                      {on && <Check className="size-3" />}
                    </span>
                    <span>{c.emoji}</span>
                    <span className="flex-1">{c.label}</span>
                    <span className="text-[11px] text-muted-foreground">{c.desc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* الخدمات المختارة */}
        {selectedCats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCats.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs">
                {c.emoji} {c.label}
                <button onClick={() => toggle(c.key)} className="hover:text-foreground"><Trash2 className="size-3" /></button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={!orgName || selected.length === 0 || saving}
            className="rounded-xl mulki-gold-bg px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {saving ? "جارٍ الحفظ…" : "حفظ خدماتي"}
          </button>
          {selectedCats.length > 0 && (
            <Link href={`/services?category=${selectedCats[0].key}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ExternalLink className="size-4" /> عاينها في الصفحة الرئيسية
            </Link>
          )}
        </div>
      </Card>

      <Card className="mulki-card p-5 max-w-2xl">
        <h3 className="font-display font-semibold mb-2">كيف يعمل؟</h3>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pe-5">
          <li>اختر خدماتك من القائمة المنسدلة (نفس الخدمات المعروضة في الصفحة الرئيسية).</li>
          <li>احفظ، فتُمنح منشأتك صلاحية عرض هذه الخدمات.</li>
          <li>تظهر منشأتك كمزوّد في صفحة <Link href="/services" className="text-primary hover:underline">سوق الخدمات</Link> ضمن التصنيفات المختارة.</li>
          <li>يصلك طلب موجّه عند اختيار العميل لمنشأتك.</li>
        </ol>
        <p className="text-[11px] text-muted-foreground mt-3">وضع تجريبي: تُحفظ الاختيارات محلياً في متصفحك. عند التفعيل الحقيقي تُحفظ في حسابك وتظهر لكل الزوّار.</p>
      </Card>
    </section>
  );
}
