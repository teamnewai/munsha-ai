"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const signup = params.get("mode") === "signup";
  const redirect = params.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    // وضع تجريبي: قبل ربط Supabase، التسجيل الجديد يذهب لفتح المكتب، والدخول للوحة.
    if (!configured) {
      router.push(signup ? "/onboarding" : redirect);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { error } = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    if (signup) {
      setMsg("تم إنشاء الحساب! تحقق من بريدك لتأكيد التسجيل.");
      return;
    }
    router.push(redirect);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* جانب الهوية */}
      <div className="relative hidden flex-col justify-between bg-brand-950 p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-lg font-extrabold text-brand-700">
            مُ
          </span>
          <span className="text-2xl font-extrabold">مُلكي</span>
        </Link>
        <div>
          <h2 className="text-3xl font-extrabold leading-snug">
            نظام تشغيل أعمالك،
            <br />
            في مكان واحد.
          </h2>
          <p className="mt-4 max-w-md text-brand-100">
            من العقار إلى المكتب الافتراضي — أدِر كل شيء بالذكاء الاصطناعي.
          </p>
        </div>
        <p className="text-sm text-brand-200">👑 6 أشهر مجاناً للأعضاء المؤسسين</p>
      </div>

      {/* النموذج */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 font-extrabold text-white">
              مُ
            </span>
            <span className="text-xl font-extrabold text-brand-900">مُلكي</span>
          </Link>

          <h1 className="text-2xl font-extrabold text-slate-900">
            {signup ? "أنشئ حسابك" : "أهلاً بعودتك"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {signup ? "ابدأ تجربتك المجانية في دقائق." : "سجّل دخولك لمتابعة عملك."}
          </p>

          {!configured && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              وضع تجريبي: لم يتم ربط قاعدة البيانات بعد. اضغط الزر للدخول واستعراض المنصة.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={configured}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={configured}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="••••••••"
              />
            </div>

            {msg && <p className="text-sm text-rose-600">{msg}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جارٍ..." : signup ? "إنشاء الحساب" : "تسجيل الدخول"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {signup ? "لديك حساب؟ " : "ليس لديك حساب؟ "}
            <Link
              href={signup ? "/login" : "/login?mode=signup"}
              className="font-bold text-brand-700 hover:underline"
            >
              {signup ? "سجّل الدخول" : "أنشئ حساباً"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
