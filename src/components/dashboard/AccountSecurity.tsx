"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

// مُلكي — تغيير كلمة المرور داخل المنصّة (بلا بريد)
// يتحقق من كلمة المرور الحالية ثم يحدّثها عبر جلسة المستخدم.
export function AccountSecurity() {
  const [email, setEmail] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // رموز الاستعادة الاحتياطية
  const [codes, setCodes] = useState<string[] | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);

  async function generateCodes() {
    setGenErr(null);
    if (!isSupabaseConfigured()) { setGenErr("الوضع التجريبي: غير متاح."); return; }
    setGenLoading(true);
    const supabase = createClient()!;
    const { data, error } = await supabase.rpc("generate_recovery_codes");
    setGenLoading(false);
    if (error) { setGenErr(error.message); return; }
    setCodes((data as string[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) return;
      const supabase = createClient()!;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setHasSession(true);
        setEmail(user.email ?? null);
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (next.length < 6) { setErr("كلمة المرور الجديدة 6 أحرف على الأقل."); return; }
    if (next !== confirm) { setErr("كلمتا المرور غير متطابقتين."); return; }
    if (!isSupabaseConfigured()) { setErr("الوضع التجريبي: غير متاح."); return; }

    setLoading(true);
    const supabase = createClient()!;

    // تحقّق أمني: أعد المصادقة بكلمة المرور الحالية (إن كان للحساب بريد)
    if (email) {
      const { error: reauth } = await supabase.auth.signInWithPassword({ email, password: current });
      if (reauth) {
        setLoading(false);
        setErr("كلمة المرور الحالية غير صحيحة.");
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (error) {
      setErr(error.message.toLowerCase().includes("session") ? "انتهت الجلسة — سجّل الدخول من جديد." : error.message);
      return;
    }
    setCurrent(""); setNext(""); setConfirm("");
    setOk("✅ تم تغيير كلمة المرور بنجاح.");
  }

  if (!hasSession) {
    return (
      <div className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-lg font-bold text-fg">الأمان وكلمة المرور</h2>
        <p className="mt-2 text-sm text-mut">سجّل الدخول لإدارة كلمة مرورك.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-6">
      <h2 className="text-lg font-bold text-fg">الأمان وكلمة المرور</h2>
      <p className="mt-1 text-sm text-mut">
        غيّر كلمة مرورك فوراً داخل المنصّة — بلا بريد ولا روابط.
        {email && <> الحساب: <span className="font-medium text-fg">{email}</span></>}
      </p>

      <form onSubmit={submit} className="mt-5 max-w-sm space-y-4">
        {email && (
          <Field label="كلمة المرور الحالية">
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required className={inputCls} placeholder="••••••••" />
          </Field>
        )}
        <Field label="كلمة المرور الجديدة">
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required className={inputCls} placeholder="••••••••" />
        </Field>
        <Field label="تأكيد كلمة المرور الجديدة">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} placeholder="••••••••" />
        </Field>
        {err && <p className="text-sm text-bad">{err}</p>}
        {ok && <p className="text-sm text-ok">{ok}</p>}
        <Button type="submit" disabled={loading}>{loading ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}</Button>
      </form>

      {/* رموز الاستعادة الاحتياطية */}
      <div className="mt-8 border-t border-line pt-6">
        <h3 className="font-bold text-fg">رموز الاستعادة الاحتياطية</h3>
        <p className="mt-1 text-sm text-mut">
          رموز تستعيد بها كلمة مرورك إن نسيتها — بلا بريد. احفظها في مكان آمن؛ كل رمز يُستخدم مرة واحدة.
        </p>

        {codes && codes.length > 0 ? (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-gold/30 bg-gold/5 p-4 font-mono text-sm sm:grid-cols-4">
              {codes.map((c) => (
                <span key={c} className="text-center font-bold tracking-wider text-fg">{c}</span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-fg hover:bg-card2"
              >
                📋 نسخ الكل
              </button>
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-fg hover:bg-card2">
                🖨️ طباعة
              </button>
            </div>
            <p className="mt-2 text-xs text-bad">⚠️ لن تظهر هذه الرموز مرة أخرى — احفظها الآن.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={generateCodes}
            disabled={genLoading}
            className="mt-4 rounded-xl border border-gold/40 bg-gold/5 px-4 py-2.5 text-sm font-bold text-gold hover:bg-gold/10 disabled:opacity-50"
          >
            {genLoading ? "جارٍ التوليد..." : "🔐 توليد رموز استعادة جديدة"}
          </button>
        )}
        {genErr && <p className="mt-2 text-sm text-bad">{genErr}</p>}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-fg">{label}</label>
      {children}
    </div>
  );
}
