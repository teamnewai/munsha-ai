-- مُلكي — تحصين أمني: تقييد إدراج سجل التدقيق (audit_log).
-- المصدر: Supabase Security Advisor (RLS Policy Always True).
-- قبل: سياسة insert بـ check(true) لدور public ⇒ يمكن لأي طرف مجهول تزوير قيود تدقيق.
-- بعد: الكتابة عبر الخادم (service_role يتجاوز RLS) أو مستخدم مسجّل الدخول فقط.
-- آمن: لا يكتب audit_log أي مسار من الواجهة بمفتاح anon (التحقق في الكود: provision.ts عبر service-role).

drop policy if exists "audit insert" on public.audit_log;
create policy "audit insert" on public.audit_log
  for insert to authenticated with check (auth.uid() is not null);
