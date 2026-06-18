"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

// مُلكي إدراك — تعيين كلمة مرور جديدة
// يصل المستخدم هنا بعد فتح رابط الاستعادة (الجلسة مهيّأة عبر /auth/callback).
export default function ResetPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) { setReady(true); return; }
      const supabase = createClient()!;
      const { data: { user } } = await supabase.auth.getUser();
      // إن لم توجد جلسة استعادة، ننبّه المستخدم لكنّنا نُظهر النموذج
      if (!user) setMsg("لم نجد جلسة استعادة صالحة. افتح رابط الاستعادة من بريدك من جديد.");
      setReady(true);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password.length < 6) { setMsg("كلمة المرور يجب أن تكون 6 أحرف على الأقل."); return; }
    if (password !== confirm) { setMsg("كلمتا المرور غير متطابقتين."); return; }
    if (!isSupabaseConfigured()) { setMsg("الوضع التجريبي: غير متاح."); return; }
    setLoading(true);
    const supabase = createClient()!;
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMsg(error.message.toLowerCase().includes("session") ? "انتهت جلسة الاستعادة. اطلب رابطاً جديداً من «نسيت كلمة المرور»." : error.message);
      return;
    }
    // تسجيل الخروج ثم العودة للدخول بالكلمة الجديدة
    await supabase.auth.signOut();
    window.location.assign("/login?reset=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold font-extrabold text-golddark">مُ</span>
          <span className="text-xl font-extrabold text-fg">مُلكي إدراك</span>
        </Link>

        <h1 className="text-2xl font-extrabold text-fg">تعيين كلمة مرور جديدة</h1>
        <p className="mt-1 text-sm text-mut">اكتب كلمة المرور الجديدة لحسابك.</p>

        {!ready ? (
          <p className="mt-6 text-sm text-mut">جارٍ التحقّق…</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">كلمة المرور الجديدة</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">تأكيد كلمة المرور</label>
              <input
                type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                placeholder="••••••••"
              />
            </div>
            {msg && <p className="text-sm text-bad">{msg}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-mut">
          <Link href="/login" className="font-bold text-gold hover:underline">← العودة لتسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
