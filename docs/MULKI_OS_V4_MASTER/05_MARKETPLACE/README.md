# 05 — MARKETPLACE ENGINE ARCHITECTURE ⭐
## النسخة الموسّعة (Expanded Blueprint)

> القلب الاقتصادي لمُلكي — شبكة قيمة ذاتية النمو. **REOS:** المنصة تسجّل وتطابق ولا تتوسّط الدفع (رسوم إدراج/ربط فقط).

## دورة الحياة (Lifecycle)
```text
Client Request → Matching → Providers → Quotes → Selection → Execution → Rating
```

## الجداول
```sql
marketplace_requests(id, org_id, service_id, client_id, country, region, city, district, budget, status)
provider_quotes(id, request_id→marketplace_requests, provider_id→service_providers, amount, timeline, status)
service_providers(id, org_id, company_name, category, composite_score, verified)
provider_ratings(id, provider_id→service_providers, request_id, stars, review, created_at)
marketplace_commissions(id, request_id, provider_id, fee_type, amount)  -- listing/connection fee فقط
```

## صيغة الترتيب (Ranking Formula)
```text
Rating 35% · Completion 25% · Response 20% · Price 10% · Experience 10%
```

## السمعة (Reputation)
- تقييم 1–5 نجوم · مراجعات موثّقة (Verified) · سجل النزاعات · درجة SLA.

## التوجيه (Matching)
- جغرافي 5 مستويات: دولة ← منطقة ← مدينة ← حي ← نوع الخدمة + مطابقة التخصص.
- **خصوصية:** رقم العميل لا يظهر للمزوّد؛ التواصل عبر قناة آمنة.

## الحوكمة
- حل النزاعات (تصعيد + أدلة) · رسوم الإدراج/الربط فقط (لا وساطة دفع).
