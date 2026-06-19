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
  if (href) {
    if (href.includes("/login") && href.includes("signup")) return "إنشاء حساب جديد";
    if (href.includes("/login")) return "الانتقال لتسجيل الدخول";
    if (href.includes("/onboarding")) return "فتح/إنشاء منشأة";
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

  async function saveNote() {
    setNoteMsg(null);
    if (!note.trim()) { setNoteMsg("اكتب ملاحظتك أولاً."); return; }
    setSaving(true);
    // محاولة الحفظ في قاعدة البيانات (إن سجّل الدخول)، وإلا حفظ محلي
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient()!;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
          const { error } = await supabase.from("page_feedback").insert({
            org_id: m?.org_id ?? null,
            user_id: user.id,
            page_path: pathname,
            page_title: document.title,
            note: note.trim(),
            status: "open",
            priority: "normal",
            section: "ملاحظة عامة",
          });
          if (!error) { setNote(""); setSaving(false); setNoteMsg("✅ حُفظت ملاحظتك في «الملاحظات»."); return; }
        }
      }
      // احتياطي: حفظ محلي على الجهاز
      const key = "mulki_notes";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.unshift({ page: pathname, note: note.trim(), at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 200)));
      setNote("");
      setNoteMsg("📝 حُفظت محلياً (سجّل الدخول لحفظها في حسابك).");
    } catch {
      setNoteMsg("تعذّر الحفظ.");
    }
    setSaving(false);
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
      {/* الزر العائم */}
      {!open && (
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
