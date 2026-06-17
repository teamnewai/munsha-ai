# 03 — VIRTUAL OFFICE OS ARCHITECTURE
## النسخة الموسّعة (Expanded Blueprint)

| | |
|---|---|
| **الإصدار** | v4.0 — Volume 3 (Expanded) |
| **يبني على** | 02 (departments, memberships, tasks, ai_agents) |
| **الحالة** | 🟢 أساس منفّذ (`/os`, `/os/desk`, `/os/ops`, `/os/control`, `/os/structure`) + توسعة |

> **الفكرة:** تحويل البرمجيات المجرّدة إلى **مكان عمل افتراضي قابل للتنقّل**. كل قسمٍ أدناه = «غرفة» في المكتب.

---

## الفصل 1 — رؤية المكتب الافتراضي
- **المشكلة:** المكاتب التقليدية = جدران + إيجار + حدود جغرافية.
- **الحل:** فصل العمل عن المكان — مكتب يعمل أينما كنت.
- **الفرق عن M365/Google Workspace:** هؤلاء *أدوات منفصلة*؛ مُلكي **نظام تشغيل موحّد** يربط الأدوات + الهيكل + الحوكمة + الذكاء + السوق في مكانٍ واحد بهوية المنشأة.

## الفصل 2 — Executive Office (مكتب المالك) ✅ منفّذ
**Dashboard:** الإيرادات · المصروفات · الأرباح · العقود · الشواغر · المشاريع — **كل رقم يُحسب من النواة** (`invoices`,`payments`,`contracts`,`units`).
**Widgets:** KPIs · AI Insights · Alerts. **تقارير تنفيذية:** يومية/أسبوعية/شهرية.
*الحالة:* `/dashboard` يعرض المؤشّرات + أداء الإدارات + الحضور + القرارات (ببيانات حقيقية).

## الفصل 3 — Employee Office (مكتب الموظف) ✅ منفّذ
ثلاثة أعمدة: المساعد الذكي «نور» · 15 أداة · المهام/المرتجعات.
المكوّنات: المهام · التقويم · البريد · الملفات · الطلبات · التقارير · الحضور والانصراف. *الحالة:* `/os/desk`.

## الفصل 4 — Operations Room (غرفة العمليات) ✅ منفّذ
**Live Dashboard:** الموظفون · العقود · الصيانة · العملاء. **Incident Center** · **SLA Tracking** · **Escalation System** (member→head→manager→gm→owner). *الحالة:* `/os/ops`.

## الفصل 5 — Meeting Center (قاعة الاجتماعات) 🔵
اجتماعات الإدارة/الأقسام/الملاك/اتحاد الملاك. تكامل Zoom/Teams/Meet + تفريغ (Whisper) + محاضر تلقائية + بنود عمل.
```sql
meetings(id, org_id, title, organizer_id, start_time, end_time, platform, recording_url, transcript_doc_id, status)
meeting_attendees(id, meeting_id, user_id, rsvp_status, attended)
meeting_decisions(id, meeting_id, decision_text, decided_by, status)
action_items(id, meeting_id, title, assignee_id, due_date, status)
```

## الفصل 6 — Visitor Reception (استقبال الزوار) 🔵
Virtual Reception (نور في وضع الاستقبال) · Visitor Pass · Guest Seat (كرسي الضيف بالصوت/الصورة) · Meeting Booking.
```sql
visitors(id, org_id, name, email, phone, company, purpose, status)
visitor_appointments(id, visitor_id, host_id, scheduled_at, duration, status)
```

## الفصل 7 — Archive Center (الأرشيف)
Documents · Contracts · Employee Files · Property Files. حذف بموافقة المدير فقط (workflow). *الحالة:* مرتبط بـ`documents` + قفل في `/os/desk`.

## الفصل 8 — Communications Hub (الاتصالات)
Chat · Voice · Video · Broadcast.
```sql
comm_channels(id, org_id, name, type)  -- chat|voice|video|broadcast
comm_messages(id, channel_id, from_id, content, created_at)
```

## الفصل 9 — Task Center
Personal/Team/Department Tasks. يبني على `tasks`+`task_comments` (مجلّد 02 §17).

## الفصل 10 — Workflow Center (الاعتمادات)
Approvals · Escalations · Routing. يبني على `workflows`+`workflow_steps`+`requests` (مجلّد 02 §24).

## الفصل 11 — Noor AI (المساعد الشخصي) ✅ منفّذ (واجهة)
كتابة الخطابات · تلخيص الاجتماعات · إنشاء التقارير · الرد على الأسئلة · إدخال صوتي عربي.
*الحالة:* `SmartSecretary` على `/os/desk` (توجيه محلي ذكي؛ يُربط بـEdge Function + OpenAI عند توفّر المفاتيح — M3).

## الفصل 12 — AI Board Room (مجلس الذكاء)
CEO AI · CFO AI · HR AI · Legal AI · Operations AI — يتعاونون عبر ناقل أحداث. (تفصيل في مجلّد 06.)

## الفصل 13 — Knowledge Center
Policies · Procedures · Manuals · SOPs. يبني على `documents` + `knowledge_documents`/`knowledge_chunks` (RAG).

## الفصل 14 — Training Center
Courses · Exams · Certifications.
```sql
courses(id, org_id, title)
course_progress(id, course_id, user_id, status, score)
```

## الفصل 15 — Microsoft 365 Integration
Outlook · Word · Excel · PowerPoint · Teams. *الحالة:* روابط launch مباشرة منفّذة في `/os/desk`؛ التحرير الأعمق يحتاج Microsoft Graph + OAuth.

## الفصل 16 — Google Workspace Integration
Gmail · Drive · Calendar · Meet (عبر منح المنصّات في مركز التحكم).

## الفصل 17 — Mobile Experience
Owner App · Employee App · Manager App. PWA أولاً (manifest منفّذ ✅)، ثم تطبيقات أصلية.

## الفصل 18 — Permissions Model (صلاحيات المكتب)
الأقدمية: `owner > gm > manager > supervisor > employee` — تتحكّم بالأدوات الظاهرة في كل غرفة (`officeFor(deptKey, seniority)`).

## الفصل 19 — Security Model
MFA · Session Control · Device Trust · Audit. (يبني على مجلّد 02 §25 + رؤوس الأمان المطبّقة.)

## الفصل 20 — Future Vision
VR Office · 3D Office (Three.js) · Hologram Meetings · Digital Twin Workspace. (يتقاطع مع مجلّد 07.)

---
*نهاية المجلّد الثالث الموسّع · MULKI OS v4.0*
> **التالي:** 04 (Business Modules) · 05 (Marketplace) · 06 (AI Workforce) · 07 (Digital Business City).
