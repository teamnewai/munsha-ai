# 04 — BUSINESS MODULES ARCHITECTURE
## النسخة الموسّعة (Expanded Blueprint)

| | |
|---|---|
| الإصدار | v4.0 — Volume 4 |
| يبني على | 02 (النواة) |
| الحالة | 🟢 معظم الوحدات منفّذة ببيانات حقيقية (قراءة) |

> الوحدات التشغيلية التي تكتب في النواة وتتغذّى منها. كل وحدة: جداول + شاشات + API + صلاحيات + قواعد عمل.

## خريطة الشاشات (Screen Map)
```text
Dashboard → Finance · Properties · Contracts · Maintenance · Marketplace · AI · Reports
Properties → Property Details · Buildings · Units · Owners · Documents
Contracts → Active · Expiring · Renewals · Archived
Marketplace → Browse · Create Request · Quotes · Providers · Ratings
```

## الوحدات
1. **العقارات** (`properties→buildings→units`) — CRUD · أنواع الوحدات · الإشغال · تقييم AI/جولات 3D (قادم). ✅
2. **الملاك/المستأجرون** (`owners`,`tenants`/`parties`) — سجلات + مستندات + بوابات (مجلّد 08). ✅
3. **العقود** (`contracts`,`contract_payments`) — دورة حياة + تنبيهات تجديد + منع تداخل. ✅
4. **الفواتير/المدفوعات** (`invoices`,`payments`) — ضريبة 15% مولّدة · REOS. ✅
5. **الصيانة/أوامر العمل** (`maintenance_requests`,`work_orders`) — approval_level مولّد + SLA. ✅
6. **المالية** (`ledger_accounts`,`ledger_entries`,`v_arrears`) — أرباح/مصروفات/متأخرات. ✅
7. **المستندات/المهام/الموارد البشرية** — مجلّد 02 §16–18.

## عقود الـAPI (API Contracts)
```http
# Auth
POST /api/auth/login · POST /api/auth/logout · POST /api/auth/register
# Properties
GET /api/properties · POST /api/properties · PUT /api/properties/{id} · DELETE /api/properties/{id}
# Contracts
GET /api/contracts · POST /api/contracts · PUT /api/contracts/{id}
# Maintenance
GET /api/maintenance · POST /api/maintenance · PUT /api/maintenance/{id}
# AI
POST /api/ai/chat · POST /api/ai/report · POST /api/ai/analyze
```
> ملاحظة: التطبيق الحالي يقرأ مباشرةً عبر Supabase Client (RLS)؛ مسارات `/api/*` تُضاف للعمليات الخادمية الحسّاسة والتكاملات.

## مصفوفة الصلاحيات (مختصر — التفصيل في 02 §ط)
| الدور | الصلاحيات |
|------|-----------|
| Owner | كل الصلاحيات |
| General Manager | إدارة الموظفين/العقود · اعتماد الصيانة/المصروفات · التقارير |
| Manager | إدارة القسم · اعتماد المهام · مراجعة التقارير |
| Supervisor | متابعة التنفيذ · توزيع المهام |
| Employee | مهامه فقط |

الهدف: **150–250 صلاحية** بصيغة `<action>_<entity>`.
