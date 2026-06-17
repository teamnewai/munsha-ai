"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ASSISTANT_NAME } from "@/lib/assistant";

interface FB {
  id: string;
  page_path: string;
  page_title: string | null;
  note: string;
  status: string;
  priority: string;
  section: string | null;
  element_label: string | null;
  reply: string | null;
  created_at: string;
}

const DEMO: FB[] = [
  { id: "1", page_path: "/dashboard/properties", page_title: "العقارات", note: "زر الإضافة صغير على الجوال", status: "open", priority: "normal", section: "العقارات", element_label: "+ إضافة عقار", reply: null, created_at: new Date().toISOString() },
  { id: "2", page_path: "/os/desk", page_title: "المكتب", note: "أبي ترتيب الأدوات حسب الأكثر استخداماً", status: "open", priority: "high", section: "الأدوات", element_label: "الأدوات (15)", reply: null, created_at: new Date().toISOString() },
];

const PRIO: Record<string, { l: string; t: string }> = {
  high: { l: "عالية", t: "bg-bad/15 text-bad" },
  normal: { l: "عادية", t: "bg-gold/15 text-gold" },
  low: { l: "منخفضة", t: "bg-card2 text-mut" },
};

export default function FeedbackPage() {
  const [items, setItems] = useState<FB[]>([]);
  const [isReal, setIsReal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Record<string, string>>({});

  async function load() {
    if (!isSupabaseConfigured()) { setItems(DEMO); setLoading(false); return; }
    const supabase = createClient()!;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setItems(DEMO); setLoading(false); return; }
    const { data } = await supabase
      .from("page_feedback")
      .select("id, page_path, page_title, note, status, priority, section, element_label, reply, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as FB[]) ?? []);
    setIsReal(true);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function resolve(id: string) {
    if (!isReal) return;
    setBusy(id);
    const supabase = createClient()!;
    await supabase.from("page_feedback").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status: "resolved" } : x)));
    setBusy(null);
  }

  async function suggest(fb: FB) {
    setBusy(fb.id);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content:
          `ملاحظة مستخدم على صفحة «${fb.page_title ?? fb.page_path}» (المسار ${fb.page_path})، القسم «${fb.section ?? "—"}»، العنصر «${fb.element_label ?? "—"}»:\n"${fb.note}"\n\nاقترح حلاً تقنياً موجزاً وخطوات الإصلاح (3 نقاط كحد أقصى).` }] }),
      });
      const data = await res.json();
      setSuggestion((s) => ({ ...s, [fb.id]: data?.reply || "فعّل مفتاح OpenAI ليقترح الحل." }));
    } catch {
      setSuggestion((s) => ({ ...s, [fb.id]: "تعذّر الاتصال بالمساعد." }));
    }
    setBusy(null);
  }

  const open = items.filter((i) => i.status !== "resolved");
  const done = items.filter((i) => i.status === "resolved");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-fg">🗒️ الملاحظات والمشاكل</h1>
        <p className="mt-1 text-sm text-mut">الملاحظات المُبلَّغة من المستخدمين عبر أداة «أبلغ عن مشكلة» — راجِعها واطلب حلاً من {ASSISTANT_NAME}.</p>
      </div>

      <div className={`rounded-xl border p-3 text-xs ${isReal ? "border-ok/30 bg-ok/10 text-ok" : "border-gold/30 bg-gold/10 text-gold"}`}>
        {isReal ? "● ملاحظات حقيقية من قاعدة بياناتك." : "وضع تجريبي: سجّل الدخول لعرض الملاحظات الحقيقية."}
      </div>

      {loading ? (
        <p className="text-sm text-mut">جارٍ التحميل…</p>
      ) : (
        <>
          <Section title={`مفتوحة (${open.length})`} items={open} {...{ busy, resolve, suggest, suggestion, isReal }} />
          {done.length > 0 && <Section title={`محلولة (${done.length})`} items={done} {...{ busy, resolve, suggest, suggestion, isReal }} resolved />}
          {items.length === 0 && <p className="rounded-2xl border border-line bg-card p-12 text-center text-sm text-mut">لا توجد ملاحظات بعد.</p>}
        </>
      )}
    </div>
  );
}

function Section({ title, items, busy, resolve, suggest, suggestion, isReal, resolved }: {
  title: string; items: FB[]; busy: string | null; isReal: boolean; resolved?: boolean;
  resolve: (id: string) => void; suggest: (fb: FB) => void; suggestion: Record<string, string>;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-mut">{title}</h2>
      <div className="space-y-3">
        {items.map((fb) => (
          <div key={fb.id} className={`rounded-2xl border border-line bg-card p-4 ${resolved ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-fg">{fb.note}</p>
                <p className="mt-1 text-xs text-mut">📍 {fb.section ?? "—"} · {fb.element_label ?? "—"} · <span className="font-mono">{fb.page_path}</span></p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${PRIO[fb.priority]?.t ?? "bg-card2 text-mut"}`}>{PRIO[fb.priority]?.l ?? fb.priority}</span>
            </div>
            {suggestion[fb.id] && (
              <div className="mt-3 rounded-xl border border-gold/20 bg-gold/5 p-3 text-sm text-fg">
                <div className="mb-1 text-xs font-bold text-gold">💡 اقتراح {ASSISTANT_NAME}:</div>
                <p className="whitespace-pre-wrap">{suggestion[fb.id]}</p>
              </div>
            )}
            {!resolved && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => suggest(fb)} disabled={busy === fb.id}
                  className="rounded-lg bg-card2 px-3 py-1.5 text-xs font-bold text-gold hover:bg-card2/70 disabled:opacity-50">
                  {busy === fb.id ? "…" : `💡 اقتراح حل (${ASSISTANT_NAME})`}
                </button>
                {isReal && (
                  <button onClick={() => resolve(fb.id)} disabled={busy === fb.id}
                    className="rounded-lg bg-ok/15 px-3 py-1.5 text-xs font-bold text-ok hover:bg-ok/25 disabled:opacity-50">
                    ✓ تم الحل
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
