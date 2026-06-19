"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// مُلكي إدراك — أداة الملاحظات داخل التطبيق:
// زر عائم → يفتح النموذج مباشرة (يلتقط القسم تلقائياً) → اكتب المشكلة → تُحفظ.
// زر اختياري داخل النموذج «حدّد عنصراً» لتظليل عنصر بعينه.

type Mode = "off" | "form" | "pick" | "sent";
interface Target { label: string; selector: string; section: string; }

function buildSelector(el: HTMLElement): string {
  if (el.id) return "#" + el.id;
  const tag = el.tagName.toLowerCase();
  const cls =
    typeof el.className === "string" && el.className
      ? "." + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".")
      : "";
  return tag + cls;
}
function currentSection(): string {
  return (
    document.querySelector("main h1, h1")?.textContent?.trim().slice(0, 60) ||
    document.title ||
    "الصفحة"
  );
}
function nearestSection(el: HTMLElement): string {
  const sec = el.closest("section,[data-section],main,header,aside");
  const h = sec?.querySelector("h1,h2,h3");
  if (h?.textContent) return h.textContent.trim().slice(0, 60);
  return currentSection();
}

export function FeedbackWidget() {
  const [mode, setMode] = useState<Mode>("off");
  const [target, setTarget] = useState<Target | null>(null);
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const hoverBox = useRef<HTMLDivElement | null>(null);

  // فتح النموذج مباشرة مع التقاط القسم الحالي تلقائياً
  function openForm() {
    setMsg(null);
    setTarget({ label: "", selector: "", section: currentSection() });
    setMode("form");
  }

  useEffect(() => {
    if (mode !== "pick") return;
    function onMove(e: MouseEvent) {
      const el = e.target as HTMLElement;
      if (!el || el.dataset.fbw) return;
      const r = el.getBoundingClientRect();
      const b = hoverBox.current;
      if (b) {
        b.style.display = "block";
        b.style.top = `${r.top}px`;
        b.style.left = `${r.left}px`;
        b.style.width = `${r.width}px`;
        b.style.height = `${r.height}px`;
      }
    }
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement;
      if (!el || el.dataset.fbw) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget({
        label: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 80),
        selector: buildSelector(el),
        section: nearestSection(el),
      });
      setMode("form");
    }
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    const prev = document.body.style.cursor;
    document.body.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.body.style.cursor = prev;
      if (hoverBox.current) hoverBox.current.style.display = "none";
    };
  }, [mode]);

  async function submit() {
    setMsg(null);
    if (!note.trim()) { setMsg("اكتب وصف المشكلة."); return; }
    if (!isSupabaseConfigured()) { setMsg("الوضع التجريبي غير متاح حالياً."); return; }
    setSaving(true);
    const supabase = createClient()!;
    // يصل المطوّر بدون تسجيل دخول (جدول public_notes)
    const { error } = await supabase.from("public_notes").insert({
      page_path: window.location.pathname,
      page_title: document.title,
      note: `[${priority}] ${note.trim()}`,
      action: "مشكلة: " + (target?.section ?? currentSection()) + (target?.label ? " · " + target.label : ""),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
    });
    setSaving(false);
    if (error) { setMsg("تعذّر الإرسال: " + error.message); return; }
    setNote("");
    setMode("sent");
    setTimeout(() => setMode("off"), 2600);
  }

  return (
    <div data-fbw="1">
      {/* مربّع التظليل أثناء التحديد */}
      <div
        ref={hoverBox}
        data-fbw="1"
        style={{ display: "none", position: "fixed", zIndex: 9998, pointerEvents: "none" }}
        className="rounded-md border-2 border-gold bg-gold/10"
      />

      {/* شريط إرشادي في وضع التحديد */}
      {mode === "pick" && (
        <div data-fbw="1" className="fixed inset-x-0 top-0 z-[10000] flex items-center justify-center gap-3 bg-gold py-2 text-sm font-bold text-golddark">
          🖱️ اضغط على القسم الذي به مشكلة…
          <button data-fbw="1" onClick={() => setMode("form")} className="rounded bg-black/20 px-2 py-0.5 text-xs">إلغاء</button>
        </div>
      )}

      {/* الزر العائم */}
      {mode === "off" && (
        <button
          type="button"
          data-fbw="1"
          onClick={openForm}
          className="fixed bottom-20 left-5 z-[10000] flex items-center gap-2 rounded-full bg-gold px-4 py-3 text-sm font-bold text-golddark shadow-lg transition-transform hover:scale-105 hover:bg-gold/90"
          title="أبلغ عن مشكلة أو اقتراح"
        >
          🎯 أبلغ عن مشكلة
        </button>
      )}

      {/* نموذج كتابة المشكلة */}
      {mode === "form" && (
        <div data-fbw="1" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setMode("off")}>
          <div data-fbw="1" className="w-full max-w-md rounded-2xl border border-line bg-card p-6 text-fg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold">الإبلاغ عن مشكلة أو اقتراح</h2>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-line bg-card2 p-2 text-xs text-mut">
              <span className="truncate">📍 القسم: <b className="text-fg">{target?.section || currentSection()}</b>{target?.label ? ` · ${target.label}` : ""}</span>
              <button data-fbw="1" onClick={() => setMode("pick")} className="shrink-0 rounded bg-gold/15 px-2 py-1 font-bold text-gold hover:bg-gold/25">
                🎯 حدّد عنصراً
              </button>
            </div>
            <textarea
              data-fbw="1"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              autoFocus
              placeholder="اكتب المشكلة أو التحسين المطلوب هنا…"
              className="mt-3 w-full rounded-xl border border-line bg-card2 px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-mut">الأولوية:</span>
              {[["low","منخفضة"],["normal","عادية"],["high","عالية"]].map(([v,l]) => (
                <button key={v} type="button" data-fbw="1" onClick={() => setPriority(v)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${priority===v ? "bg-gold text-golddark" : "bg-card2 text-mut"}`}>{l}</button>
              ))}
            </div>
            {msg && <p className="mt-2 text-sm text-bad">{msg}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" data-fbw="1" onClick={() => setMode("off")} disabled={saving} className="rounded-xl px-4 py-2 text-sm text-mut hover:bg-card2">إلغاء</button>
              <button type="button" data-fbw="1" onClick={submit} disabled={saving} className="rounded-xl bg-gold px-5 py-2 text-sm font-bold text-golddark hover:bg-gold/90 disabled:opacity-50">
                {saving ? "جارٍ الإرسال…" : "إرسال"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تأكيد */}
      {mode === "sent" && (
        <div data-fbw="1" className="fixed bottom-20 left-5 z-[10000] rounded-xl bg-ok px-4 py-3 text-sm font-bold text-white shadow-lg">
          ✅ تم استلام ملاحظتك — بتُراجَع وتُحل.
        </div>
      )}
    </div>
  );
}
