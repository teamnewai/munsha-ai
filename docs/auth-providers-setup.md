# تفعيل مزوّدات الدخول — مُلكي

> الكود في `src/app/login/page.tsx` يدعم: بريد+كلمة مرور · رمز بريد · جوال SMS · Google.
> المتبقّي إعدادات لوحة Supabase + مفاتيح المزوّدين (تُنفَّذ من حساب المالك).
> مشروع Supabase: `https://fgincdqvhnuarqcdnsfe.supabase.co`

---

## 0) إعداد عام (مطلوب لكل الطرق) — Site URL
Supabase → **Authentication → URL Configuration**
- **Site URL:** `https://munsha-ai.vercel.app` (أو دومينك الفعلي)
- **Redirect URLs** (Add): `https://munsha-ai.vercel.app/**` و `http://localhost:3000/**`

---

## 1) بريد + كلمة مرور (الأسرع — بلا مزوّد خارجي) ⭐
Supabase → **Authentication → Providers → Email**
- **Confirm email = OFF** (إيقاف)
- احفظ. → الآن «دخول/إنشاء حساب» يعمل فوراً بلا أي بريد.

---

## 2) بريد موثوق (SMTP عبر Resend) — لإيصال الرموز/الروابط فعلاً
SMTP الافتراضي في Supabase محدود (3–4 رسائل/ساعة) ولا يصلح للإنتاج.

**أ) أنشئ مفتاح Resend:**
1. سجّل في resend.com → **Domains** → أضِف دومينك وتحقّق (DNS records).
2. **API Keys** → أنشئ مفتاحاً (يبدأ بـ `re_...`).

**ب) في Supabase → Authentication → Emails → SMTP Settings → Enable Custom SMTP:**
| الحقل | القيمة |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | مفتاح Resend (`re_...`) |
| Sender email | `no-reply@yourdomain.com` |
| Sender name | `مُلكي` |

**ج) لرمز البريد (OTP):** Authentication → **Email Templates** → «Magic Link» و«Confirm signup» → ضع:
```html
<p>رمز الدخول إلى مُلكي:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
```

---

## 3) رسائل SMS للجوال (Twilio)
**أ) من Twilio:** سجّل → احصل على: **Account SID**, **Auth Token**, وأنشئ **Messaging Service SID** (أو رقم مُرسِل).

**ب) في Supabase → Authentication → Providers → Phone → Enable:**
- SMS provider: **Twilio**
- ألصق: Account SID · Auth Token · Message Service SID
- احفظ. → تبويب «الجوال» في صفحة الدخول يعمل.

> بديل سعودي: Supabase يدعم Twilio / MessageBird / Vonage / Textlocal أصلاً.
> لاستخدام **Unifonic** (سعودي) يلزم Auth Hook مخصّص (Edge Function) — أكتبه لك عند الطلب وتزوّدني بمفتاح Unifonic كـ Secret.

---

## 4) الدخول بحساب Google
**أ) Google Cloud Console:**
1. أنشئ مشروعاً → **APIs & Services → OAuth consent screen** (املأه).
2. **Credentials → Create Credentials → OAuth client ID → Web application**.
3. **Authorized redirect URI:** `https://fgincdqvhnuarqcdnsfe.supabase.co/auth/v1/callback`
4. انسخ **Client ID** و**Client Secret**.

**ب) في Supabase → Authentication → Providers → Google → Enable:**
- ألصق Client ID + Client Secret → احفظ. → زر «المتابعة بحساب Google» يعمل.

---

## ملخّص الحالة
| الطريقة | الكود | المتبقّي (أنت) |
|---|---|---|
| بريد + كلمة مرور | ✅ | تعطيل Confirm email |
| رمز بريد | ✅ | SMTP + `{{ .Token }}` |
| جوال SMS | ✅ | مزوّد Twilio في Supabase |
| Google | ✅ | OAuth Client في Supabase |

> ما لا أستطيعه: الوصول للوحة Supabase أو إنشاء حسابات المزوّدين (تحتاج بريدك/بطاقتك).
> ما أستطيعه: كتابة أي Edge Function/كود تكامل إضافي (مثل Unifonic) عند تزويدي بالمفتاح كـ Secret.
