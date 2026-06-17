"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { seedDemoData } from "@/lib/seedDemo";

// يظهر فقط حين تكون منشأة المستخدم فارغة (لا عقارات) — يزيل حاجز «اللوحة الفارغة».
export function SeedDemoButton() {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) return;
      const supabase = createClient()!;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!m?.org_id) return;
      const { count } = await supabase.from("properties").select("id", { count: "exact", head: true }).eq("org_id", m.org_id);
      setOrgId(m.org_id);
      setEmpty((count ?? 0) === 0);
    })();
  }, []);

  async function run() {
    if (!orgId) return;
    setBusy(true);
    setMsg(null);
    const res = await seedDemoData(orgId);
    setMsg(res.message);
    setBusy(false);
    if (res.ok) {
      setTimeout(() => { setEmpty(false); router.refresh(); }, 900);
    }
  }

  if (!empty) return null;

  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-fg">🚀 ابدأ في 10 ثوانٍ</h2>
          <p className="mt-1 text-xs text-mut">منشأتك فارغة. عبّئها بدورة عمل تجريبية كاملة (عقار + وحدتان + عقد + فواتير + دفعة) لتستكشف المنصة فوراً.</p>
          {msg && <p className="mt-2 text-xs font-bold text-gold">{msg}</p>}
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90 disabled:opacity-50"
        >
          {busy ? "جارٍ التعبئة…" : "عبّئ بيانات تجريبية"}
        </button>
      </div>
    </div>
  );
}
