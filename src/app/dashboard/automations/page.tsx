"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// محرّك الأتمتة (Automation Engine): قواعد «إذا X فافعل Y» تولّد إشعارات حقيقية.
const RULES: { key: string; label: string; desc: string; icon: string }[] = [
  { key: "contract_expiry", label: "تنبيه انتهاء العقود", desc: "عقد نشط ينتهي خلال 30 يوماً → إشعار + اقتراح تجديد.", icon: "📄" },
  { key: "invoice_overdue", label: "تنبيه الفواتير المتأخرة", desc: "فاتورة تجاوزت تاريخ استحقاقها → إشعار متابعة تحصيل.", icon: "🧾" },
  { key: "maintenance_pending", label: "تنبيه الصيانة المعلّقة", desc: "طلب صيانة مفتوح/قيد التنفيذ → إشعار للإسناد أو الاعتماد.", icon: "🔧" },
];

interface Notif { id: string; title: string; body: string | null; kind: string; is_read: boolean; created_at: string; }

export default function AutomationsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isReal, setIsReal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState<Record<string, boolean>>({});
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadNotifs = useCallback(async (oid: string) => {
    const supabase = createClient()!;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, kind, is_read, created_at")
      .eq("org_id", oid)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifs((data as Notif[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) { setLoading(false); return; }
      const supabase = createClient()!;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!m?.org_id) { setLoading(false); return; }
      setOrgId(m.org_id);
      setIsReal(true);
      const { data: rules } = await supabase.from("automation_rules").select("rule_key, enabled").eq("org_id", m.org_id);
      const off: Record<string, boolean> = {};
      ((rules as { rule_key: string; enabled: boolean }[]) ?? []).forEach((r) => { if (!r.enabled) off[r.rule_key] = true; });
      setDisabled(off);
      await loadNotifs(m.org_id);
      setLoading(false);
    })();
  }, [loadNotifs]);

  async function toggle(key: string) {
    if (!orgId) return;
    const nowEnabled = disabled[key]; // كان معطّلاً → سيُفعّل
    setDisabled((d) => ({ ...d, [key]: !d[key] }));
    const supabase = createClient()!;
    await supabase.from("automation_rules").upsert(
      { org_id: orgId, rule_key: key, enabled: nowEnabled },
      { onConflict: "org_id,rule_key" }
    );
  }

  async function run() {
    if (!orgId) return;
    setRunning(true); setMsg(null);
    const supabase = createClient()!;
    const { data, error } = await supabase.rpc("run_automations", { p_org: orgId });
    if (error) setMsg("تعذّر التشغيل: " + error.message);
    else { setMsg(`اكتمل التشغيل ✓ — تم توليد ${data ?? 0} إشعاراً جديداً.`); await loadNotifs(orgId); }
    setRunning(false);
  }

  const kindTone: Record<string, string> = { warning: "border-bad/30 bg-bad/5", info: "border-line bg-card", success: "border-ok/30 bg-ok/5" };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-fg">⚙️ محرّك الأتمتة</h1>
          <p className="mt-1 text-sm text-mut">قواعد «إذا حدث X فافعل Y» — تراقب عقودك وفواتيرك وصيانتك وتولّد تنبيهات تلقائية.</p>
        </div>
        <button onClick={run} disabled={running || !isReal}
          className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90 disabled:opacity-50">
          {running ? "جارٍ التشغيل…" : "▶ تشغيل الآن"}
        </button>
      </div>

      <div className={`rounded-xl border p-3 text-xs ${isReal ? "border-ok/30 bg-ok/10 text-ok" : "border-gold/30 bg-gold/10 text-gold"}`}>
        {isReal ? "● متصل ببياناتك — القواعد تعمل على عقودك وفواتيرك الحقيقية." : "سجّل الدخول لتشغيل الأتمتة على بياناتك."}
      </div>
      {msg && <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">{msg}</div>}

      {/* القواعد */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-mut">القواعد</h2>
        {RULES.map((r) => {
          const on = !disabled[r.key];
          return (
            <div key={r.key} className="flex items-center justify-between rounded-2xl border border-line bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-card2 text-lg">{r.icon}</span>
                <div>
                  <p className="font-bold text-fg">{r.label}</p>
                  <p className="mt-0.5 text-xs text-mut">{r.desc}</p>
                </div>
              </div>
              <button onClick={() => toggle(r.key)} disabled={!isReal}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-gold" : "bg-card2"}`}
                aria-label="تفعيل/تعطيل">
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-0.5" : "right-0.5"}`} />
              </button>
            </div>
          );
        })}
      </section>

      {/* الإشعارات المُولّدة */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-mut">الإشعارات المُولّدة ({notifs.length})</h2>
        {loading ? (
          <p className="text-sm text-mut">جارٍ التحميل…</p>
        ) : notifs.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card p-10 text-center text-sm text-mut">
            لا إشعارات بعد. اضغط «تشغيل الآن» لفحص بياناتك وتوليد التنبيهات.
          </div>
        ) : (
          notifs.map((n) => (
            <div key={n.id} className={`rounded-xl border p-3 ${kindTone[n.kind] ?? "border-line bg-card"}`}>
              <p className="text-sm font-medium text-fg">{n.title}</p>
              {n.body && <p className="mt-0.5 text-xs text-mut">{n.body}</p>}
              <p className="mt-1 text-[10px] text-mut">{new Date(n.created_at).toLocaleString("ar-SA")}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
