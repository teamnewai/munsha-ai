import { callClaude } from "@/lib/ai";

export const runtime = "nodejs";

// مُلكي — توليد الهيكل التنظيمي بالذكاء الاصطناعي (Claude أولاً، مع ارتداد للمولّد المحلي)
// السرّ يبقى على الخادم. إن لم يوجد مفتاح يرجع ok=false فيستخدم العميل generateStructure المحلي.

const SCALES = [
  { scale: "micro", max: 5, label: "منشأة متناهية الصغر (1–5)", model: "هيكل بسيط" },
  { scale: "small", max: 25, label: "منشأة صغيرة (6–25)", model: "هيكل وظيفي" },
  { scale: "medium", max: 100, label: "منشأة متوسطة (26–100)", model: "هيكل قطاعي" },
  { scale: "large", max: Infinity, label: "منشأة كبيرة (101+)", model: "بيروقراطية آلية" },
];

export async function POST(req: Request) {
  let body: { activity?: string; activityName?: string; employees?: number; name?: string } = {};
  try { body = await req.json(); } catch { /* تجاهل */ }

  const employees = Math.max(1, Math.min(1_000_000, Number(body.employees) || 20));
  const scaleRow = SCALES.find((s) => employees <= s.max)!;

  // حدّ طول المدخلات النصية غير الموثوقة (منع إساءة استخدام موازنة الطلب)
  const activity = (body.activityName || body.activity || "غير محدد").slice(0, 2000);
  const orgName = (body.name || "منشأة").slice(0, 200);

  const sys = `أنت خبير في التصميم التنظيمي والحوكمة (أطر ISO وCOBIT وPMI وMintzberg وRACI).
مهمتك: توليد هيكل تنظيمي مثالي لمنشأة عربية بناءً على نشاطها وعدد موظفيها.
أعد JSON فقط (دون أي نص آخر) بالشكل:
{"departments":[{"key":"finance","name":"الإدارة المالية","icon":"💰","isCore":true,"sections":[{"name":"المحاسبة"}],"roles":["المدير المالي","محاسب"]}]}
القواعد: 4-9 إدارات حسب الحجم، أسماء عربية، أيقونة إيموجي مناسبة لكل إدارة، 1-4 أقسام فرعية و2-5 مناصب لكل إدارة، استخدم مفاتيح إنجليزية قصيرة للإدارة (key).`;

  const user = `النشاط: ${activity}
عدد الموظفين: ${employees} (فئة: ${scaleRow.label})
اسم المنشأة: ${orgName}
ولّد الهيكل الأمثل المناسب لهذا الحجم والنشاط.`;

  try {
    const c = await callClaude(sys, [{ role: "user", content: user }], { maxTokens: 2000 });
    if (!c.ok) return Response.json({ ok: false, configured: c.configured, error: c.error });
    const text: string = c.text;
    const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr) as { departments?: unknown[] };
    const departments = Array.isArray(parsed.departments) ? parsed.departments : [];
    if (departments.length === 0) return Response.json({ ok: false, configured: true, error: "empty" });

    // تطبيع وحساب العدادات
    type Dep = { key: string; name: string; icon?: string; isCore?: boolean; sections?: { name: string }[]; roles?: string[] };
    const depts = (departments as Dep[]).map((d, i) => ({
      key: d.key || `dept${i}`,
      name: d.name || "إدارة",
      icon: d.icon || "🏢",
      isCore: Boolean(d.isCore),
      sections: Array.isArray(d.sections) ? d.sections.filter((s) => s?.name).map((s) => ({ name: s.name })) : [],
      roles: Array.isArray(d.roles) ? d.roles.filter(Boolean) : [],
    }));
    const sectionCount = depts.reduce((s, d) => s + d.sections.length, 0);
    const roleCount = depts.reduce((s, d) => s + d.roles.length, 0);

    const structure = {
      scale: scaleRow.scale,
      scaleLabel: scaleRow.label,
      model: `ذكاء اصطناعي (Claude) · ${scaleRow.model}`,
      departments: depts,
      deptCount: depts.length,
      sectionCount,
      roleCount,
      version: "AI-" + new Date().toISOString().slice(0, 10),
    };
    return Response.json({ ok: true, configured: true, structure });
  } catch (e) {
    return Response.json({ ok: false, configured: true, error: String(e).slice(0, 200) });
  }
}
