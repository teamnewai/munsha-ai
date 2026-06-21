-- مُلكي — تحصين أمني: تثبيت search_path لدوال التطبيق.
-- المصدر: Supabase Security Advisor (Function Search Path Mutable).
-- السبب: عدم تثبيت search_path قد يسمح بخطف الدالة عبر كائنات في مخطط آخر.
-- النطاق: دوال التطبيق ذات SECURITY INVOKER فقط — مساعدات RLS (SECURITY DEFINER:
--         is_tenant_member/is_tenant_admin/has_role) مثبّتة مسبقاً. دوال pgvector مستثناة.
-- آمن: ALTER ... set search_path لا يغيّر منطق الدالة.

alter function public.assign_membership_no() set search_path = public;
alter function public.derive_member_perms(p_job_title text, p_role_in_dept text) set search_path = public;
alter function public.gen_doc_no(p_prefix text) set search_path = public;
alter function public.gen_form_no(p_dept text) set search_path = public;
alter function public.gen_ref_code() set search_path = public;
alter function public.lock_assistant_name() set search_path = public;
alter function public.prevent_audit_modification() set search_path = public;
alter function public.region_code(p_city text) set search_path = public;
alter function public.touch_virtual_tours() set search_path = public;
