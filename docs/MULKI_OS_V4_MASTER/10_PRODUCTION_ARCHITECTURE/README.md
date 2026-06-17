# 10 — PRODUCTION ARCHITECTURE
## بنية الإنتاج

| | |
|---|---|
| **الحالة** | 🔵 مخطّط (رؤوس الأمان: ✅ موجودة) |

## المخطّط
1. **الستاك** — Next.js 16 + React 19 + TypeScript · Tailwind v4 RTL · Supabase (PG+Auth+RLS+Edge) · Vercel · Resend.
2. **الأمان** — رؤوس HSTS/X-Frame/CSP (✅ في next.config) · RLS · تشفير الحقول الحسّاسة · إخفاء X-Powered-By.
3. **طبقة الدفع المجرّدة** — Stripe/Moyasar/Tap/HyperPay · المفاتيح كمتغيّرات بيئة في Vercel (لا في الكود).
4. **الأداء** — فهرسة org_id · تقييم RLS بـ InitPlan · CDN · تحسين Three.js.
5. **المراقبة** — سجلّات · تنبيهات · advisors من Supabase · تتبّع الأخطاء.
6. **النسخ والاستمرارية** — نسخ Supabase الاحتياطية · استراتيجية الترحيل (0001→0005) · بيئات منفصلة.
7. **المسارات** — Vercel (فاتح، الموقع الحيّ) و Lovable (داكن/ذهبي) منفصلان.
8. **CI/CD** — GitHub → Vercel · مراجعة الترحيلات قبل الدفع.

> **التالي:** 11_LAUNCH_PLAN.
