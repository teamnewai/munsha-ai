"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { safeRedirect } from "@/lib/security";
import { Button } from "@/components/ui/Button";

function LoginInner() {
  const params = useSearchParams();
  // أمان: منع إعادة التوجيه المفتوح — مسارات داخلية فقط
  const redirect = safeRedirect(params.get("redirect"));

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  // وجهة ما بعد الدخول: منشأة قائمة → اللوحة؛ لا منشأة → فتح المكتب
  async function routeAfterAuth() {
    const supabase = createClient();
    if (!supabase) return window.location.assign(redirect);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { count } = await supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      return window.location.assign(count && count > 0 ? redirect : "/onboarding");
    }
    window.location.assign(redirect);
  }

  // إرسال رمز التحقق إلى البريد (بلا روابط)
  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg(null);
    setOk(null);
    if (!email.trim()) {
      setMsg("اكتب بريدك الإلكتروني أولاً.");
      return;
    }
    if (!configured) {
      window.location.assign("/onboarding");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setPhase("code");
    setOk("📧 أرسلنا رمزاً من 6 أرقام إلى بريدك. أدخله أدناه.");
  }

  // التحقق من الرمز وتسجيل الدخول
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const token = code.replace(/\s/g, "");
    if (token.length < 6) {
      setMsg("أدخل الرمز المكوّن من 6 أرقام.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (error) {
      setLoading(false);
      const m = error.message.toLowerCase();
      setMsg(m.includes("expired") || m.includes("invalid") ? "الرمز غير صحيح أو منتهٍ. أعد الإرسال." : error.message);
      return;
    }
    await routeAfterAuth();
  }

  // مسار بديل: كلمة المرور (للحسابات القديمة)
  async function passwordLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!configured) {
      window.location.assign(redirect);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      const m = error.message.toLowerCase();
      setMsg(m.includes("invalid login") ? "البريد أو كلمة المرور غير صحيحة." : error.message);
      return;
    }
    await routeAfterAuth();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* جانب الهوية */}
      <div className="relative hidden flex-col justify-between bg-brand-950 p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-card text-lg font-extrabold text-gold">
            مُ
          </span>
          <span className="text-2xl font-extrabold">مُلكي إدراك</span>
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
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold font-extrabold text-golddark">
              مُ
            </span>
            <span className="text-xl font-extrabold text-fg">مُلكي إدراك</span>
          </Link>

          <h1 className="text-2xl font-extrabold text-fg">الدخول / التسجيل</h1>
          <p className="mt-1 text-sm text-mut">
            أدخل بريدك ونرسل لك رمز دخول — بلا كلمات مرور وبلا روابط.
          </p>

          {!configured && (
            <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-gold">
              وضع تجريبي: لم يتم ربط قاعدة البيانات بعد. اضغط الزر للدخول واستعراض المنصة.
            </div>
          )}

          {ok && <div className="mt-4 rounded-xl border border-ok/30 bg-ok/10 p-3 text-xs text-ok">{ok}</div>}

          {/* تدفّق الرمز عبر البريد */}
          {!usePassword && phase === "email" && (
            <form onSubmit={sendCode} className="mt-6 space-y-4">
              <Field label="البريد الإلكتروني">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={configured}
                  className={inputCls}
                  placeholder="name@example.com"
                />
              </Field>
              {msg && <p className="text-sm text-bad">{msg}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جارٍ الإرسال..." : "إرسال رمز الدخول"}
              </Button>
            </form>
          )}

          {!usePassword && phase === "code" && (
            <form onSubmit={verifyCode} className="mt-6 space-y-4">
              <Field label={`الرمز المُرسَل إلى ${email}`}>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${inputCls} text-center text-lg tracking-[0.5em]`}
                  placeholder="------"
                  maxLength={6}
                />
              </Field>
              {msg && <p className="text-sm text-bad">{msg}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جارٍ التحقق..." : "تأكيد ودخول"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setPhase("email"); setCode(""); setMsg(null); }} className="font-bold text-mut hover:underline">
                  ← تغيير البريد
                </button>
                <button type="button" onClick={() => sendCode()} disabled={loading} className="font-bold text-gold hover:underline disabled:opacity-50">
                  إعادة إرسال الرمز
                </button>
              </div>
            </form>
          )}

          {/* مسار كلمة المرور (بديل للحسابات القديمة) */}
          {usePassword && (
            <form onSubmit={passwordLogin} className="mt-6 space-y-4">
              <Field label="البريد الإلكتروني">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={configured} className={inputCls} placeholder="name@example.com" />
              </Field>
              <Field label="كلمة المرور">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={configured} className={inputCls} placeholder="••••••••" />
              </Field>
              {msg && <p className="text-sm text-bad">{msg}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جارٍ..." : "تسجيل الدخول"}
              </Button>
              <Link href="/forgot" className="block text-center text-xs font-bold text-gold hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </form>
          )}

          {/* مبدّل الطريقة */}
          <div className="my-5 flex items-center gap-3 text-xs text-mut">
            <span className="h-px flex-1 bg-line" />
            أو
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={() => { setUsePassword((v) => !v); setMsg(null); setOk(null); setPhase("email"); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-card2 px-4 py-2.5 text-sm font-bold text-fg hover:bg-card2/70"
          >
            {usePassword ? "✉️ الدخول برمز عبر البريد" : "🔑 الدخول بكلمة المرور"}
          </button>
        </div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
