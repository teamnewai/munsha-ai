"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// مُلكي إدراك — «خريطة الصفحة»: مربّع عائم يرافقك في كل صفحة،
// يفحص كل الأزرار والروابط ويعرض: النص · الوجهة (الرابط) · المهمة.

interface Item {
  kind: "link" | "button";
  label: string;
  href: string | null;
  mission: string;
  el: HTMLElement;
}

// استنتاج «مهمة» العنصر من نصّه/وجهته
function inferMission(label: string, href: string | null, kind: string): string {
  const t = (label + " " + (href ?? "")).toLowerCase();
  if (/أنشئ مكتبك|افتح مكتبك|مكتبك الافتراضي/.test(label)) return "يحوّلك إلى أداة توليد الهيكل التنظيمي (إدارات · مناصب · صلاحيات)";
  if (href) {
    if (href.includes("/login") && href.includes("signup")) return "إنشاء حساب جديد";
    if (href.includes("/login")) return "الانتقال لتسجيل الدخول";
    if (href.includes("/onboarding")) return "يحوّلك إلى أداة توليد الهيكل التنظيمي للمنشأة";
    if (href.includes("/dashboard/providers")) return "مزوّدو الخدمات";
    if (href.includes("/dashboard")) return "لوحة التحكم";
    if (href.includes("/pricing")) return "صفحة الأسعار والباقات";
    if (href.includes("/beta")) return "برنامج الشركاء/العملاء المؤسِّسين";
    if (href.includes("/forgot")) return "استعادة كلمة المرور";
    if (href.includes("/os")) return "نظام التشغيل";
    if (href.includes("whatsapp") || href.includes("wa.me")) return "تواصل واتساب";
    if (href.startsWith("#")) return "الانتقال لقسم في نفس الصفحة";
    if (href.startsWith("mailto:")) return "إرسال بريد";
    if (href.startsWith("http")) return "رابط خارجي";
    return "الانتقال إلى " + href;
  }
  if (/إرسال|حفظ|تأكيد|إضافة|أضف|اشترك|سجّل|تسجيل/.test(t)) return "إجراء: إرسال/حفظ";
  if (/إلغاء|إغلاق|×/.test(t)) return "إغلاق/إلغاء";
  if (/حذف|إزالة/.test(t)) return "حذف";
  return "زرّ إجراء داخل الصفحة";
}

export function PageInspector() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  // خانة كتابة الملاحظات
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteMsg, setNoteMsg] = useState<string | null>(null);

  // وضع الشرح: اضغط أي زر لمعرفة وظيفته (دون تنفيذه)
  const [explain, setExplain] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; label: string; mission: string; href: string | null; kind: string } | null>(null);
  const [tipMsg, setTipMsg] = useState<string | null>(null);

  // حفظ ملاحظة عامة — تصل المطوّر مباشرة بدون تسجيل دخول (جدول public_notes)
  async function logNote(text: string, action: string): Promise<boolean> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient()!;
        const { error } = await supabase.from("public_notes").insert({
          page_path: pathname,
          page_title: typeof document !== "undefined" ? document.title : null,
          note: text,
          action,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
        });
        if (!error) return true;
      }
      // احتياطي محلي عند تعذّر الاتصال
      const key = "mulki_notes";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.unshift({ page: pathname, note: text, at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 200)));
      return false;
    } catch { return false; }
  }

  // إجراء سريع على عنصر من بطاقة الشرح
  async function flag(action: string) {
    if (!tip) return;
    const text = `[${action}] العنصر «${tip.label}» — الوظيفة: ${tip.mission}${tip.href ? " — الوجهة: " + tip.href : ""}`;
    const saved = await logNote(text, action);
    setTipMsg(saved ? `✅ وصل «${action}» للمطوّر — سيُنفَّذ.` : `📝 سُجّل «${action}» محلياً (سيُرسَل عند عودة الاتصال).`);
  }

  useEffect(() => {
    if (!explain) return;
    function onClick(e: MouseEvent) {
      const raw = e.target as HTMLElement;
      if (!raw || raw.closest("[data-pginspect]")) return; // لا نعترض لوحتنا
      const el = raw.closest("a[href], button") as HTMLElement | null;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const isLink = el.tagName.toLowerCase() === "a";
      const href = isLink ? el.getAttribute("href") : null;
      const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "—").replace(/\s+/g, " ").trim().slice(0, 60) || "(بلا نص)";
      setTipMsg(null);
      setTip({
        x: Math.min(e.clientX, window.innerWidth - 20),
        y: e.clientY,
        label,
        mission: inferMission(label, href, isLink ? "link" : "button"),
        href,
        kind: isLink ? "link" : "button",
      });
    }
    document.addEventListener("click", onClick, true);
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "help";
    return () => {
      document.removeEventListener("click", onClick, true);
      document.body.style.cursor = prevCursor;
    };
  }, [explain]);

  async function saveNote() {
    setNoteMsg(null);
    if (!note.trim()) { setNoteMsg("اكتب ملاحظتك أولاً."); return; }
    setSaving(true);
    const ok = await logNote(note.trim(), "ملاحظة عامة");
    setSaving(false);
    setNote("");
    setNoteMsg(ok ? "✅ وصلت ملاحظتك — سيراجعها المطوّر وينفّذها." : "📝 حُفظت محلياً (سنرسلها عند عودة الاتصال).");
  }

  const scan = useCallback(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("a[href], button")
    ).filter((el) => !el.closest("[data-pginspect]") && !el.closest("[data-fbw]"));
    const list: Item[] = nodes.map((el) => {
      const isLink = el.tagName.toLowerCase() === "a";
      const href = isLink ? el.getAttribute("href") : null;
      const label =
        (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "—")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60) || "(بلا نص)";
      return {
        kind: isLink ? "link" : "button",
        label,
        href,
        mission: inferMission(label, href, isLink ? "link" : "button"),
        el,
      };
    });
    setItems(list);
  }, []);

  useEffect(() => {
    if (open) scan();
  }, [open, pathname, scan]);

  function highlight(el: HTMLElement) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const prev = el.style.outline;
    const prevOffset = el.style.outlineOffset;
    el.style.outline = "3px solid var(--color-gold)";
    el.style.outlineOffset = "2px";
    setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = prevOffset; }, 1800);
  }

  const links = items.filter((i) => i.kind === "link");
  const buttons = items.filter((i) => i.kind === "button");

  return (
    <div data-pginspect="1">
      {/* شريط «وضع الشرح» */}
      {explain && (
        <div className="fixed inset-x-0 top-0 z-[10002] flex items-center justify-center gap-3 bg-gold py-2 text-sm font-bold text-golddark">
          🛈 وضع الشرح مُفعّل — اضغط أي زر لمعرفة وظيفته (لن يُنفَّذ)
          <button onClick={() => { setExplain(false); setTip(null); }} className="rounded bg-black/20 px-2 py-0.5 text-xs">إيقاف</button>
        </div>
      )}

      {/* بطاقة الشرح المنبثقة */}
      {tip && (
        <div
          className="fixed z-[10003] w-64 -translate-x-1/2 rounded-xl border border-gold/40 bg-card p-3 text-sm shadow-2xl"
          style={{ top: Math.min(tip.y + 12, window.innerHeight - 160), left: tip.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-extrabold text-fg">{tip.kind === "link" ? "🔗" : "🔘"} {tip.label}</span>
            <button onClick={() => setTip(null)} className="text-xs text-mut hover:text-fg">✕</button>
          </div>
          <div className="mt-2 rounded-lg bg-card2 p-2 text-xs text-fg">
            <div>🎯 <span className="text-mut">الوظيفة:</span> {tip.mission}</div>
            {tip.href && <div className="mt-1 truncate font-mono text-gold">↪ {tip.href}</div>}
            {!tip.href && <div className="mt-1 text-mut">إجراء داخل الصفحة (لا ينقلك لصفحة أخرى)</div>}
          </div>
          {tip.href && (
            <a href={tip.href} className="mt-2 block rounded-lg mulki-gold-bg px-3 py-1.5 text-center text-xs font-bold">
              تنفيذ الانتقال فعلاً ←
            </a>
          )}
          {/* إجراءات سريعة على العنصر */}
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[["لا يعمل","🔴"],["عدّل","✏️"],["أصلح","🔧"],["أضف","➕"]].map(([a, e]) => (
              <button key={a} onClick={() => flag(a)}
                className="rounded-lg border border-line bg-card2 px-1 py-1.5 text-[11px] font-bold text-fg hover:border-gold/50">
                <span className="block">{e}</span>{a}
              </button>
            ))}
          </div>
          {tipMsg && <p className="mt-1.5 text-[11px] font-bold text-gold">{tipMsg}</p>}
        </div>
      )}

      {/* الزر العائم */}
      {!open && !explain && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[10001] flex items-center gap-2 rounded-full bg-brand-950 px-4 py-3 text-sm font-bold text-white shadow-lg ring-1 ring-gold/40 transition-transform hover:scale-105"
          title="خريطة الصفحة — كل الأزرار وروابطها"
        >
          🧭 خريطة الصفحة
        </button>
      )}

      {/* اللوحة */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[10001] flex max-h-[80vh] w-[92vw] max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-line bg-card2 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-fg">🧭 خريطة الصفحة</h2>
              <p className="mt-0.5 text-[11px] text-mut font-mono">{pathname}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={scan} className="rounded-lg bg-gold/15 px-2.5 py-1 text-xs font-bold text-gold hover:bg-gold/25">↻ تحديث</button>
              <button onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-mut hover:bg-card">✕</button>
            </div>
          </div>

          <div className="overflow-y-auto p-3 text-sm">
            {/* وضع الشرح */}
            <button
              onClick={() => { setExplain((v) => !v); setTip(null); if (!explain) setOpen(false); }}
              className={`mb-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${explain ? "bg-bad/15 text-bad" : "mulki-gold-bg"}`}
            >
              {explain ? "⏹ إيقاف وضع الشرح" : "🛈 وضع الشرح — اضغط أي زر لمعرفة وظيفته"}
            </button>

            {/* خانة كتابة الملاحظات */}
            <div className="mb-3 rounded-xl border border-gold/30 bg-gold/5 p-2.5">
              <label className="mb-1 block text-xs font-bold text-gold">📝 اكتب ملاحظتك على هذه الصفحة</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="مثال: زر «إرسال الطلب» لا يحفظ، أو أريد تكبير الخط هنا…"
                className="w-full rounded-lg border border-line bg-card2 px-2.5 py-2 text-sm text-fg placeholder:text-mut/60 focus:border-gold focus:outline-none"
              />
              {noteMsg && <p className="mt-1 text-[11px] font-bold text-gold">{noteMsg}</p>}
              <div className="mt-1.5 flex justify-end">
                <button onClick={saveNote} disabled={saving}
                  className="rounded-lg bg-gold px-4 py-1.5 text-xs font-bold text-golddark hover:bg-gold/90 disabled:opacity-50">
                  {saving ? "جارٍ الحفظ…" : "حفظ الملاحظة"}
                </button>
              </div>
            </div>

            <div className="mb-2 flex gap-2 text-[11px] text-mut">
              <span className="rounded-full bg-card2 px-2 py-0.5">🔗 روابط: {links.length}</span>
              <span className="rounded-full bg-card2 px-2 py-0.5">🔘 أزرار: {buttons.length}</span>
            </div>

            {links.length > 0 && (
              <Section title="الروابط" items={links} onPick={highlight} />
            )}
            {buttons.length > 0 && (
              <Section title="الأزرار" items={buttons} onPick={highlight} />
            )}
            {items.length === 0 && <p className="p-6 text-center text-mut">لا عناصر تفاعلية في هذه الصفحة.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, items, onPick }: { title: string; items: Item[]; onPick: (el: HTMLElement) => void }) {
  return (
    <div className="mb-3">
      <h3 className="mb-1.5 text-xs font-bold text-mut">{title} ({items.length})</h3>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <button
            key={i}
            onClick={() => onPick(it.el)}
            className="block w-full rounded-xl border border-line bg-card2 p-2.5 text-right hover:border-gold/50"
            title="اضغط لتمييز العنصر في الصفحة"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-bold text-fg">{it.kind === "link" ? "🔗" : "🔘"} {it.label}</span>
            </div>
            <div className="mt-1 text-[11px] text-mut">🎯 {it.mission}</div>
            {it.href && <div className="mt-0.5 truncate font-mono text-[11px] text-gold">{it.href}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
