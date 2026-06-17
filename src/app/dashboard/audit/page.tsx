"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface ErrRow {
  id: string;
  message: string;
  source: string | null;
  page_path: string | null;
  status: string;
  created_at: string;
}

export default function AuditPage() {
  const [items, setItems] = useState<ErrRow[]>([]);
  const [isReal, setIsReal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    const supabase = createClient()!;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("client_errors")
      .select("id, message, source, page_path, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as ErrRow[]) ?? []);
    setIsReal(true);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function resolve(id: string) {
    if (!isReal) return;
    setBusy(id);
    const supabase = createClient()!;
    await supabase.from("client_errors").update({ status: "resolved" }).eq("id", id);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status: "resolved" } : x)));
    setBusy(null);
  }

  const open = items.filter((i) => i.status !== "resolved");
  const done = items.filter((i) => i.status === "resolved");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-fg">🔒 سجل التدقيق والأخطاء</h1>
        <p className="mt-1 text-sm text-mut">الأخطاء التقنية المُلتقَطة تلقائياً (Crash Monitoring) — راجِعها وعلّم المحلولة.</p>
      </div>

      <div className={`rounded-xl border p-3 text-xs ${isReal ? "border-ok/30 bg-ok/10 text-ok" : "border-gold/30 bg-gold/10 text-gold"}`}>
        {isReal ? "● سجلّ حقيقي من قاعدة بياناتك." : "سجّل الدخول لعرض السجل الحقيقي."}
      </div>

      {loading ? (
        <p className="text-sm text-mut">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-ok/20 bg-ok/5 p-12 text-center text-sm text-ok">
          ✅ لا توجد أخطاء مُسجَّلة — كل شيء يعمل بسلاسة.
        </div>
      ) : (
        <>
          <Group title={`مفتوحة (${open.length})`} items={open} busy={busy} resolve={resolve} />
          {done.length > 0 && <Group title={`محلولة (${done.length})`} items={done} busy={busy} resolve={resolve} resolved />}
        </>
      )}
    </div>
  );
}

function Group({ title, items, busy, resolve, resolved }: {
  title: string; items: ErrRow[]; busy: string | null; resolve: (id: string) => void; resolved?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-mut">{title}</h2>
      <div className="space-y-2">
        {items.map((e) => (
          <div key={e.id} className={`rounded-xl border border-line bg-card p-4 ${resolved ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-mono text-sm text-fg">{e.message}</p>
                <p className="mt-1 text-xs text-mut">
                  {e.source ?? "—"} · <span className="font-mono">{e.page_path ?? "—"}</span> · {new Date(e.created_at).toLocaleString("ar-SA")}
                </p>
              </div>
              {!resolved && (
                <button onClick={() => resolve(e.id)} disabled={busy === e.id}
                  className="rounded-lg bg-ok/15 px-3 py-1.5 text-xs font-bold text-ok hover:bg-ok/25 disabled:opacity-50">
                  ✓ تم الحل
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
