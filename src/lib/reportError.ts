import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// مُلكي إدراك — مُبلِّغ الأخطاء (Crash Monitoring) — أفضل جهد، لا يكسر التطبيق أبداً.
// يكتب في client_errors ضمن منشأة المستخدم (RLS: auth.uid()=user_id).

// منع الإغراق: لا نُرسل نفس الخطأ مرتين في نفس الجلسة.
const seen = new Set<string>();

export async function reportError(
  message: string,
  opts: { source?: string; stack?: string } = {}
) {
  try {
    if (!message || !isSupabaseConfigured()) return;
    const key = (opts.source ?? "") + "|" + message.slice(0, 200);
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 50) return; // سقف أمان لكل جلسة

    const supabase = createClient();
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return; // RLS يتطلّب user_id؛ لا نُبلّغ قبل تسجيل الدخول

    let orgId: string | null = null;
    const { data: m } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    orgId = m?.org_id ?? null;

    await supabase.from("client_errors").insert({
      org_id: orgId,
      user_id: user.id,
      message: message.slice(0, 1000),
      source: opts.source ?? null,
      stack: opts.stack?.slice(0, 4000) ?? null,
      page_path: typeof window !== "undefined" ? window.location.pathname : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
    });
  } catch {
    // لا نُصدِر أي استثناء من المُبلِّغ نفسه
  }
}
