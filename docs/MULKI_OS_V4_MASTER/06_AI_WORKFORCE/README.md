# 06 — AI WORKFORCE ARCHITECTURE ⭐
## النسخة الموسّعة (Expanded Blueprint)

> قوة عمل ذكية = force multiplier. طبقتان: خدم أساسيون (أدوار) + مستشارون فئة عليا (توصيات/قرارات).

## الوكلاء ومهامهم
| الوكيل | الدور | أبرز المهام |
|-------|------|-------------|
| **Noor AI** | سكرتير شخصي | كتابة الخطابات · تلخيص الاجتماعات · إنشاء التقارير · البحث في الملفات |
| **CEO AI** | ذكاء تنفيذي | تحليل الأداء · تحليل المخاطر · اقتراح القرارات |
| **CFO AI** | ذكاء مالي | تحليل الإيرادات/المصروفات · التدفق النقدي · ZATCA |
| **HR AI** | موارد بشرية | تقييم الموظفين · التوظيف · التدريب |
| **Legal AI** | قانوني | مراجعة العقود · الامتثال · المخاطر القانونية |
| Operations/Sales/Property/Marketplace AI | متخصّصون | (مجلّد 02 §20) |

## البنية
```sql
ai_agents(id, org_id, agent_type, status)
ai_conversations(id, agent_id→ai_agents, user_id, message, response)
ai_memory(id, agent_id→ai_agents, embedding vector, content)   -- pgvector (RAG)
knowledge_documents/knowledge_chunks                            -- قاعدة المعرفة
```
**التقنية:** Supabase Edge Functions + OpenAI GPT-4o + pgvector. ⏳ ينتظر مفاتيح API مدفوعة (M3).

## طبقة الذاكرة
قصيرة (الجلسة) · طويلة (سجل القرارات) · تنظيمية (حزمة معرفة المنشأة) · مشتركة (تعاون الوكلاء).

## الحوكمة (Escalation)
```text
كشف حدث → تنفيذ تلقائي (ضمن الحد) | موافقة (عند التجاوز) | إيقاف وطلب توجيه (عند الغموض)
```

## مجلس الذكاء (AI Board Room)
تعاون عبر ناقل أحداث: Sales → Property → CFO → Legal (مثال: عميل جديد → توفّر وحدة → ميزانية → عقد).
