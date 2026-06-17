# 10 — PRODUCTION ARCHITECTURE
## النسخة الموسّعة (Expanded Blueprint)

## الستاك
Next.js 16 + React 19 + TS · Tailwind v4 (RTL، داكن/ذهبي) · Supabase (PG+Auth+RLS+Edge) · Vercel · Resend · pgvector.

## دليل التشغيل (Production Runbook)
**يومي:** صحة قاعدة البيانات · سجلات الأخطاء · مراقبة API · التحقق من النسخ الاحتياطي.
**أسبوعي:** فحص أمني · تدقيق أداء · مراجعة التكلفة.
**شهري:** اختبار التعافي من الكوارث · تدقيق امتثال · تخطيط السعة.

## استراتيجية الجودة (QA)
- **Unit Tests:** هدف > 90%.
- **Integration:** API · Database · AI · Marketplace.
- **End-to-End:** Property Flow · Contract Flow · Maintenance Flow · Marketplace Flow.

## الأمن والامتثال (Security & Compliance)
**الأمن:** MFA · تشفير · RLS · سجلات تدقيق · التحكم بالجلسات. (رؤوس CSP/HSTS مطبّقة ✅، إصلاح v_arrears مطبّق ✅).
**الامتثال:**
- السعودية: **PDPL** (خصوصية) · **ZATCA** (فوترة) · **REGA** (عقاري).
- الخليج: أنظمة محلية. — عالمي: **GDPR** + متطلبات إقليمية.

## النشر
GitHub `main` → Vercel (تلقائي). متغيّرات البيئة في Vercel. مفاتيح Supabase العامة آمنة للمتصفح؛ service_role خادمي فقط.
