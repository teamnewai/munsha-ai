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
