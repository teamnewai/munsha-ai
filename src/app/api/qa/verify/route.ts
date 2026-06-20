import { callClaude } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// وكيل ضمان الجودة: يستقبل بلاغ مستخدم → يحلّله بالذكاء الاصطناعي → يُعيد تقرير التحقق.
export async function POST(req: Request) {
  let body: { note?: string; page?: string; action?: string; element?: string; noteId?: string } = {};
  try { body = await req.json(); } catch { /* تجاهل */ }

  const { note, page, action, element, noteId } = body;
  if (!note?.trim()) return Response.json({ ok: false, error: "لا يوجد نص للتحليل" }, { status: 400 });

  const system = `أنت «وكيل جودة مُلكي» — متخصص في تحليل مشكلات واجهة منصة مُلكي OS (نظام تشغيل المكاتب الافتراضية).
مهمتك: قراءة بلاغ المستخدم، التحقق من المشكلة، وإعطاء المطوّر توجيهاً منظّماً.
أجب دائماً بالعربية. كن دقيقاً ومختصراً. استخدم هذا الهيكل:
✅ التحقق: [هل هذه مشكلة حقيقية أم سوء فهم؟]
⚠️ الخطورة: [حرجة / متوسطة / منخفضة]
🔧 الإصلاح المقترح: [ما يجب فعله للمطوّر]
⏱️ الوقت المتوقع: [سريع (<1h) / متوسط (1-4h) / كبير (>4h)]`;

  const userMsg = `بلاغ مستخدم من منصة مُلكي OS:
• الصفحة: ${page || "غير محددة"}
• الإجراء: ${action || "غير محدد"}
• العنصر: ${element || "غير محدد"}
• الملاحظة: ${note}

حلّل هذا البلاغ وأعطِ تقرير التحقق.`;

  const result = await callClaude(system, [{ role: "user", content: userMsg }], {
    maxTokens: 400,
    temperature: 0.2,
  });

  const aiReply = result.ok ? result.text : null;

  if (aiReply && noteId) {
    const sb = createAdminClient();
    if (sb) {
      await sb.from("public_notes")
        .update({ ai_reply: aiReply, status: "reviewed" })
        .eq("id", noteId);
    }
  }

  return Response.json({
    ok: true,
    analysis: aiReply,
    configured: result.ok || (result as { ok: false; configured: boolean }).configured !== false,
  });
}
