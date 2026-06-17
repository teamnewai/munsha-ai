-- ============================================================
-- مُلكي — بيانات أولية: حدود الباقات وكتالوج الخدمات
-- مرجع: وثيقة «الشجرة» — المرحلة السادسة (الثمار / التسعير)
-- ============================================================

-- الباقات: الفاتورة = الأعلى بين (الاستخدام الفعلي) و(حدّ الباقة)
-- الحصص المجانية لكل نوع وحدة، والفائض 3 ر.س/وحدة
insert into plan_limits (tier, price_sar, unit_quota, features) values
  ('free', 0,
    '{"apartment":1,"room":1,"studio":1,"villa":1,"shop":1,"office":1,"land":1,"warehouse":1}'::jsonb,
    '["مكتب افتراضي واحد","هيكل تلقائي","سوق محدود","تطبيق"]'::jsonb),
  ('growth', 50,
    '{"apartment":12,"room":10,"studio":7,"villa":6,"shop":5,"office":5,"land":3,"warehouse":2}'::jsonb,
    '["إدارة العقود والفواتير","سوق الصيانة","بوابة المستأجر"]'::jsonb),
  ('professional', 150,
    '{"apartment":12,"room":10,"studio":7,"villa":6,"shop":5,"office":5,"land":3,"warehouse":2}'::jsonb,
    '["تسويق الشاغر","كشف المالك","الفريق","المساعد الذكي"]'::jsonb),
  ('business', 300,
    '{"apartment":12,"room":10,"studio":7,"villa":6,"shop":5,"office":5,"land":3,"warehouse":2}'::jsonb,
    '["الشقق المخدومة","الاتفاقيات الإلكترونية","العلامة البيضاء"]'::jsonb),
  ('enterprise', 500,
    '{"apartment":12,"room":10,"studio":7,"villa":6,"shop":5,"office":5,"land":3,"warehouse":2}'::jsonb,
    '["أولوية الدعم","تهيئة مخصّصة","تكاملات حسب الطلب"]'::jsonb)
on conflict (tier) do update
  set price_sar = excluded.price_sar,
      unit_quota = excluded.unit_quota,
      features = excluded.features;

-- كتالوج الخدمات الأولي للسوق البيني (يتوسّع ديناميكياً — «الورقة التي تزيد»)
insert into service_catalog (key, name, category) values
  ('plumbing', 'سباكة', 'maintenance'),
  ('electrical', 'كهرباء', 'maintenance'),
  ('ac', 'تكييف', 'maintenance'),
  ('cleaning', 'نظافة', 'cleaning'),
  ('painting', 'دهان', 'maintenance'),
  ('carpentry', 'نجارة', 'maintenance'),
  ('pest_control', 'مكافحة حشرات', 'maintenance'),
  ('legal', 'استشارات قانونية', 'consulting'),
  ('accounting', 'محاسبة', 'consulting'),
  ('marketing', 'تسويق', 'consulting')
on conflict (key) do nothing;
