"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

// مُلكي إدراك — طلب استعادة كلمة المرور
// يرسل رابطاً للبريد → يمرّ عبر /auth/callback (تبادل الرمز) → /reset لتعيين كلمة جديدة.
export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
            <p className="mt-1 text-sm text-mut">اكتب بريدك وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-fg">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                  placeholder="name@example.com"
                />
              </div>
              {msg && <p className="text-sm text-bad">{msg}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-mut">
              تذكّرت كلمتك؟{" "}
              <Link href="/login" className="font-bold text-gold hover:underline">
                تسجيل الدخول
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
