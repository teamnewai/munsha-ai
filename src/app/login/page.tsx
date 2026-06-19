"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { safeRedirect } from "@/lib/security";
import { Button } from "@/components/ui/Button";

type Method = "email" | "phone" | "google";

function LoginInner() {
  const params = useSearchParams();
  const redirect = safeRedirect(params.get("redirect"));
  const configured = isSupabaseConfigured();

  const [method, setMethod] = useState<Method>("email");
  const [emailMode, setEmailMode] = useState<"password" | "code">("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false); // للرمز (بريد/جوال)

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function reset(m: Method) {
    setMethod(m);
    setMsg(null);
    setOk(null);
    setOtpSent(false);
    setCode(""); setPassword("");
  }

  // وجهة ما بعد الدخول: منشأة قائمة → اللوحة؛ لا منشأة → فتح المكتب
  async function routeAfterAuth() {
    const supabase = createClient();
    if (!supabase) return window.location.assign(redirect);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { count } = await supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      return window.location.assign(count && count > 0 ? redirect : "/onboarding");
    }
    window.location.assign(redirect);
  }

  function fail(error: { message: string }) {
    setLoading(false);
    const m = error.message.toLowerCase();
    if (m.includes("invalid login")) setMsg("البريد أو كلمة المرور غير صحيحة.");
    else if (m.includes("expired") || m.includes("invalid")) setMsg("الرمز غير صحيح أو منتهٍ. أعد الإرسال.");
    else if (m.includes("already registered")) setMsg("الحساب موجود — كلمة المرور غير صحيحة.");
    else setMsg(error.message);
  }

  // ── بريد + كلمة مرور (دخول فوري يربط الحساب بالبريد) ──
  async function emailPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!configured) return window.location.assign("/onboarding");
    if (!email.trim() || password.length < 6) { setMsg("اكتب بريدك وكلمة مرور من 6 أحرف على الأقل."); return; }
    setLoading(true);
    const supabase = createClient()!;
    const signIn = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!signIn.error) return routeAfterAuth();
    const signUp = await supabase.auth.signUp({ email: email.trim(), password });
    if (signUp.error) return fail(signUp.error);
    if (signUp.data.session) return routeAfterAuth();
    setLoading(false);
    setMsg("تم إنشاء الحساب، لكن «تأكيد البريد» مفعّل في Supabase. عطّله: Authentication → Providers → Email → Confirm email.");
  }

  // ── رمز عبر البريد ──
  async function emailCodeSend(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg(null); setOk(null);
    if (!configured) return window.location.assign("/onboarding");
    if (!email.trim()) { setMsg("اكتب بريدك أولاً."); return; }
    setLoading(true);
    const supabase = createClient()!;
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setLoading(false);
    if (error) return setMsg(error.message);
    setOtpSent(true);
    setOk("📧 أرسلنا رمزاً من 6 أرقام إلى بريدك.");
  }

  // ── جوال + SMS ──
  async function phoneSend(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg(null); setOk(null);
    if (!configured) return window.location.assign("/onboarding");
    const p = normalizePhone(phone);
    if (!p) { setMsg("اكتب رقم جوال صحيح (مثال: 05xxxxxxxx)."); return; }
    setLoading(true);
    const supabase = createClient()!;
    const { error } = await supabase.auth.signInWithOtp({ phone: p });
    setLoading(false);
    if (error) return setMsg(error.message);
    setOtpSent(true);
    setOk(`📱 أرسلنا رمزاً برسالة نصية إلى ${p}.`);
  }

  // ── تأكيد الرمز (بريد أو جوال) ──
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const token = code.replace(/\s/g, "");
    if (token.length < 6) { setMsg("أدخل الرمز المكوّن من 6 أرقام."); return; }
    setLoading(true);
    const supabase = createClient()!;
    const res =
      method === "phone"
        ? await supabase.auth.verifyOtp({ phone: normalizePhone(phone)!, token, type: "sms" })
        : await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (res.error) return fail(res.error);
    await routeAfterAuth();
  }

  // ── Google ──
  async function google() {
    setMsg(null);
    if (!configured) return window.location.assign("/onboarding");
    setLoading(true);
    const supabase = createClient()!;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}` },
    });
    if (error) { setLoading(false); setMsg(error.message); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* جانب الهوية */}
      <div className="relative hidden flex-col justify-between bg-brand-950 p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-card text-lg font-extrabold text-gold">مُ</span>
          <span className="text-2xl font-extrabold">مُلكي إدراك</span>
        </Link>
        <div>
          <h2 className="text-3xl font-extrabold leading-snug">نظام تشغيل أعمالك،<br />في مكان واحد.</h2>
          <p className="mt-4 max-w-md text-brand-100">من العقار إلى المكتب الافتراضي — أدِر كل شيء بالذكاء الاصطناعي.</p>
        </div>
        <p className="text-sm text-brand-200">👑 6 أشهر مجاناً للأعضاء المؤسسين</p>
      </div>

      {/* النموذج */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold font-extrabold text-golddark">مُ</span>
            <span className="text-xl font-extrabold text-fg">مُلكي إدراك</span>
          </Link>

          <h1 className="text-2xl font-extrabold text-fg">الدخول / التسجيل</h1>
          <p className="mt-1 text-sm text-mut">اختر طريقة الدخول المناسبة لك.</p>

          {/* مبدّل الطرق */}
          <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-card2 p-1">
            <Tab active={method === "email"} onClick={() => reset("email")}>✉️ البريد</Tab>
            <Tab active={method === "phone"} onClick={() => reset("phone")}>📱 الجوال</Tab>
            <Tab active={method === "google"} onClick={() => reset("google")}>Google</Tab>
          </div>

          {!configured && (
            <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-gold">
              وضع تجريبي: لم يتم ربط قاعدة البيانات بعد. اضغط للدخول واستعراض المنصة.
            </div>
          )}
          {ok && <div className="mt-4 rounded-xl border border-ok/30 bg-ok/10 p-3 text-xs text-ok">{ok}</div>}

          {/* ── طريقة البريد ── */}
          {method === "email" && (
            <>
              <div className="mt-5 flex gap-4 text-sm">
                <SubTab active={emailMode === "password"} onClick={() => { setEmailMode("password"); setOtpSent(false); setMsg(null); }}>كلمة مرور</SubTab>
                <SubTab active={emailMode === "code"} onClick={() => { setEmailMode("code"); setOtpSent(false); setMsg(null); }}>رمز عبر البريد</SubTab>
              </div>

              {emailMode === "password" && (
                <form onSubmit={emailPassword} className="mt-4 space-y-4">
                  <Field label="البريد الإلكتروني"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={configured} className={inputCls} placeholder="name@example.com" /></Field>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-sm font-medium text-fg">كلمة المرور</label>
                      <Link href="/forgot" className="text-xs font-bold text-gold hover:underline">نسيت كلمة المرور؟</Link>
                    </div>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={configured} className={inputCls} placeholder="••••••••" />
                  </div>
                  {msg && <p className="text-sm text-bad">{msg}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "جارٍ..." : "دخول / إنشاء حساب"}</Button>
                </form>
              )}

              {emailMode === "code" && !otpSent && (
                <form onSubmit={emailCodeSend} className="mt-4 space-y-4">
                  <Field label="البريد الإلكتروني"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={configured} className={inputCls} placeholder="name@example.com" /></Field>
                  {msg && <p className="text-sm text-bad">{msg}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال الرمز"}</Button>
                </form>
              )}

              {emailMode === "code" && otpSent && <CodeForm {...{ code, setCode, verify, loading, msg, onResend: emailCodeSend, onBack: () => setOtpSent(false) }} />}
            </>
          )}

          {/* ── طريقة الجوال ── */}
          {method === "phone" && (
            !otpSent ? (
              <form onSubmit={phoneSend} className="mt-5 space-y-4">
                <Field label="رقم الجوال"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required={configured} className={inputCls} placeholder="05xxxxxxxx" dir="ltr" /></Field>
                {msg && <p className="text-sm text-bad">{msg}</p>}
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال الرمز برسالة نصية"}</Button>
              </form>
            ) : (
              <CodeForm {...{ code, setCode, verify, loading, msg, onResend: phoneSend, onBack: () => setOtpSent(false) }} />
            )
          )}

          {/* ── Google ── */}
          {method === "google" && (
            <div className="mt-5">
              <button type="button" onClick={google} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-card2 px-4 py-3 text-sm font-bold text-fg hover:bg-card2/70 disabled:opacity-50">
                <span className="text-base">🟦</span> المتابعة بحساب Google
              </button>
              {msg && <p className="mt-3 text-sm text-bad">{msg}</p>}
              <p className="mt-3 text-center text-[11px] text-mut">يتطلب تفعيل مزوّد Google في Supabase.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* عناصر مساعدة */
function CodeForm({ code, setCode, verify, loading, msg, onResend, onBack }: {
  code: string; setCode: (v: string) => void; verify: (e: React.FormEvent) => void;
  loading: boolean; msg: string | null; onResend: () => void; onBack: () => void;
}) {
  return (
    <form onSubmit={verify} className="mt-4 space-y-4">
      <Field label="الرمز المُرسَل (6 أرقام)">
        <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} className={`${inputCls} text-center text-lg tracking-[0.5em]`} placeholder="------" />
      </Field>
      {msg && <p className="text-sm text-bad">{msg}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "جارٍ التحقق..." : "تأكيد ودخول"}</Button>
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={onBack} className="font-bold text-mut hover:underline">← رجوع</button>
        <button type="button" onClick={onResend} disabled={loading} className="font-bold text-gold hover:underline disabled:opacity-50">إعادة إرسال الرمز</button>
      </div>
    </form>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg py-2 text-sm font-bold transition-colors ${active ? "bg-card text-fg shadow-sm" : "text-mut hover:text-fg"}`}>
      {children}
    </button>
  );
}
function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`border-b-2 pb-1 font-bold transition-colors ${active ? "border-gold text-fg" : "border-transparent text-mut hover:text-fg"}`}>
      {children}
    </button>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-fg">{label}</label>
      {children}
    </div>
  );
}

// 05xxxxxxxx → +9665xxxxxxxx ؛ يقبل صيغاً دولية أيضاً
function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, "");
  if (/^\+\d{8,15}$/.test(s)) return s;
  if (/^05\d{8}$/.test(s)) return "+966" + s.slice(1);
  if (/^5\d{8}$/.test(s)) return "+966" + s;
  if (/^9665\d{8}$/.test(s)) return "+" + s;
  return null;
}

const inputCls = "w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
