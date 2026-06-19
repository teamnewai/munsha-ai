"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

// مُلكي إدراك — طلب استعادة كلمة المرور
// يرسل رابطاً للبريد → يمرّ عبر /auth/callback (تبادل الرمز) → /reset لتعيين كلمة جديدة.
export default function ForgotPage() {
  const [mode, setMode] = useState<"code" | "email">("code");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // استعادة برمز احتياطي (بلا بريد)
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!isSupabaseConfigured()) {
      setMsg("الوضع التجريبي: غير متاح حالياً.");
      return;
    }
    setLoading(true);
    const supabase = createClient()!;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset`,
    });
    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setSent(true);
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!isSupabaseConfigured()) { setMsg("الوضع التجريبي: غير متاح حالياً."); return; }
    if (password.length < 6) { setMsg("كلمة المرور 6 أحرف على الأقل."); return; }
    if (password !== confirm) { setMsg("كلمتا المرور غير متطابقتين."); return; }
    setLoading(true);
    const supabase = createClient()!;
    const { data, error } = await supabase.rpc("reset_password_with_code", {
      p_email: email.trim(),
      p_code: code.trim(),
      p_new_password: password,
    });
    setLoading(false);
    const res = data as { ok?: boolean; reason?: string } | null;
    if (error) { setMsg(error.message); return; }
    if (!res?.ok) {
      setMsg(res?.reason === "weak_password" ? "كلمة المرور ضعيفة." : "البريد أو رمز الاستعادة غير صحيح.");
      return;
    }
    window.location.assign("/login?reset=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold font-extrabold text-golddark">مُ</span>
          <span className="text-xl font-extrabold text-fg">مُلكي إدراك</span>
        </Link>

        {sent ? (
          <div className="rounded-2xl border border-ok/30 bg-ok/10 p-6 text-center">
            <div className="text-3xl">📧</div>
            <h1 className="mt-3 text-lg font-extrabold text-fg">تحقّق من بريدك</h1>
            <p className="mt-2 text-sm text-mut">
              أرسلنا رابط استعادة كلمة المرور إلى <b className="text-fg">{email}</b>. افتح الرابط لتعيين كلمة مرور جديدة.
            </p>
            <p className="mt-3 text-xs text-mut">لم يصلك؟ تحقّق من مجلد «غير المرغوب/Spam».</p>
            <Link href="/login" className="mt-5 inline-block text-sm font-bold text-gold hover:underline">
              ← العودة لتسجيل الدخول
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-fg">نسيت كلمة المرور؟</h1>
            <p className="mt-1 text-sm text-mut">استعد حسابك برمز احتياطي (فوري بلا بريد) أو عبر رابط بريد.</p>

            {/* مبدّل الطريقة */}
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-card2 p-1">
              <button type="button" onClick={() => { setMode("code"); setMsg(null); }} className={`rounded-lg py-2 text-sm font-bold ${mode === "code" ? "bg-card text-fg shadow-sm" : "text-mut"}`}>🔐 رمز احتياطي</button>
              <button type="button" onClick={() => { setMode("email"); setMsg(null); }} className={`rounded-lg py-2 text-sm font-bold ${mode === "email" ? "bg-card text-fg shadow-sm" : "text-mut"}`}>📧 رابط بريد</button>
            </div>

            {mode === "code" ? (
              <form onSubmit={submitCode} className="mt-5 space-y-4">
                <Field label="البريد الإلكتروني">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="name@example.com" />
                </Field>
                <Field label="رمز الاستعادة">
                  <input value={code} onChange={(e) => setCode(e.target.value)} required className={`${inputCls} font-mono tracking-wider`} placeholder="XXXX-XXXX" dir="ltr" />
                </Field>
                <Field label="كلمة المرور الجديدة">
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} placeholder="••••••••" />
                </Field>
                <Field label="تأكيد كلمة المرور">
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} placeholder="••••••••" />
                </Field>
                {msg && <p className="text-sm text-bad">{msg}</p>}
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "جارٍ..." : "استعادة وتعيين كلمة المرور"}</Button>
              </form>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-4">
                <Field label="البريد الإلكتروني">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="name@example.com" />
                </Field>
                {msg && <p className="text-sm text-bad">{msg}</p>}
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}</Button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-mut">
              تذكّرت كلمتك؟{" "}
              <Link href="/login" className="font-bold text-gold hover:underline">تسجيل الدخول</Link>
            </p>
          </>
        )}
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
