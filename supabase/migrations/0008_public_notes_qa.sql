-- مُلكي — جدول الملاحظات العامة (QA / تقارير المشكلات)
-- يُستخدَم من أداة «خريطة الصفحة» وأداة «أبلغ عن مشكلة» — لا يتطلب تسجيل دخول للإدراج.

create table if not exists public_notes (
  id          uuid primary key default gen_random_uuid(),
  page_path   text,
  page_title  text,
  note        text not null,
  action      text,
  user_agent  text,
  ai_reply    text,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

alter table public_notes enable row level security;

-- أي زائر (حتى بلا تسجيل دخول) يستطيع إدراج ملاحظة
create policy "public_insert_notes" on public_notes
  for insert with check (true);

-- المستخدمون المسجّلون يستطيعون القراءة (للمسؤولين)
create policy "auth_select_notes" on public_notes
  for select using (auth.role() = 'authenticated');

-- Service role يحدّث السجل بردّ الذكاء الاصطناعي
create policy "service_update_notes" on public_notes
  for update using (auth.role() = 'service_role');
