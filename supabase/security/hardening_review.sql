-- ============================================================
-- مُلكي — سكربت تحصين أمني للمراجعة (Phase 3)
-- ⚠️ لا يُطبَّق تلقائياً — راجِعه وطبّقه يدوياً بعد الاختبار على نسخة/فرع.
-- المصدر: Supabase Security Advisors على مشروع mulki-reos.
-- السبب في وضعه خارج supabase/migrations/: حتى لا يُشغّله `supabase db push`.
-- ============================================================

-- ------------------------------------------------------------
-- 1) [ERROR] Security Definer View: public.v_arrears
-- المشكلة: العرض يعمل بصلاحيات منشئه فيتجاوز RLS.
-- الإصلاح الموصى به: اجعله يحترم صلاحيات المستخدم الحالي (Postgres 15+).
-- خطر منخفض، لكن اختبر تقرير المتأخرات بعده.
-- ------------------------------------------------------------
alter view public.v_arrears set (security_invoker = on);

-- ------------------------------------------------------------
-- 2) [WARN] RLS Policy Always True — تحتاج تمييزاً دقيقاً:
--
-- (أ) مقصودة بالتصميم (استقبال عام من الزوّار) — لا تُغيّر إلا بإضافة قيود خفيفة:
--     • public.leads               (leads_insert_public)   — التقاط عملاء من الواجهة العامة
--     • public.partner_applications(papp_insert)           — طلبات الشركاء
--     • public.blueprint_orders    (bo_insert)             — طلبات إصدار الهيكل
--   توصية: أبقِها، لكن أضِف تحقّقاً من الأعمدة/الحد لمنع الإساءة (rate limit على مستوى التطبيق).
--
-- (ب) يُفضّل تقييدها: public.audit_log (audit insert)
--   التدقيق يجب أن يُكتب عبر triggers/الخادم لا من أي طرف.
--   ✅ طُبّق في supabase/migrations/0009_restrict_audit_log_insert.sql
-- drop policy if exists "audit insert" on public.audit_log;
-- create policy "audit insert" on public.audit_log
--   for insert to authenticated with check (auth.uid() is not null);

-- ------------------------------------------------------------
-- 3) [WARN] Function Search Path Mutable (≈9 دوال)
-- ✅ طُبّق في supabase/migrations/0010_pin_function_search_path.sql
--   (دوال التطبيق التسع. مساعدات RLS بصلاحية DEFINER كانت مثبّتة مسبقاً.
--    دوال pgvector مستثناة لأنها مملوكة للإضافة — تُعالَج ببند «Extension in Public».)
-- للاكتشاف مستقبلاً:
-- ------------------------------------------------------------
-- select 'alter function '||quote_ident(n.nspname)||'.'||quote_ident(p.proname)||
--        '('||pg_get_function_identity_arguments(p.oid)||') set search_path = public;' as fix
-- from pg_proc p join pg_namespace n on n.oid=p.pronamespace
-- where n.nspname='public'
--   and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%');
-- ثم راجِع المخرجات ونفّذها (تحصين لا يغيّر السلوك غالباً).

-- ------------------------------------------------------------
-- 4) [WARN] Extension in Public
-- انقل الإضافات إلى مخطّط منفصل (اختياري، تحسين تنظيمي):
--   create schema if not exists extensions;
--   -- ثم: alter extension <name> set schema extensions;  (اختبر التبعيات)

-- ------------------------------------------------------------
-- 5) [WARN] Leaked Password Protection — ليست SQL، بل إعداد:
-- Supabase Dashboard → Authentication → Policies → فعّل "Leaked password protection".
-- ============================================================
