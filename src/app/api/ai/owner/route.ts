import { callClaude, sanitizeMessages } from "@/lib/ai";

export const runtime = "nodejs";

// مُلكي — مساعد المالك: يحلّل المنشأة كاملة ويوصي بقرارات (بسياق ملخّص المنشأة).
export async function POST(req: Request) {
  let body: { summary?: string; orgName?: string; messages?: unknown } = {};
  try { body = await req.json(); } catch { /* تجاهل */ }

  const orgName = (body.orgName || "المنشأة").slice(0, 200);
  const summary = (typeof body.summary === "string" ? body.summary : "لا توجد بيانات كافية.").slice(0, 8000);
  const messages = sanitizeMessages(body.messages);

  const system = `أنت «مساعد المالك» الذكي في منصّة مُلكي لتشغيل الأعمال، تساعد مالك «${orgName}».
لديك صورة شاملة عن المنشأة:
${summary}

دورك: تحليل الأداء، كشف المخاطر والفرص، واقتراح قرارات إدارية عملية مبنية على البيانات أعلاه وأطر الحوكمة (ISO · COBIT · PMI · RACI).
أجب بالعربية بإيجاز ومهنية، بنقاط عملية قابلة للتنفيذ، واستند إلى الأرقام المتاحة. إن نقصت بيانات، اذكر ما يلزم لاتخاذ القرار.`;

  const c = await callClaude(system, messages, { maxTokens: 900, temperature: 0.5 });
  if (c.ok) return Response.json({ reply: c.text, configured: true });

  const last = messages[messages.length - 1]?.content ?? "";
  const reply =
    `مساعد المالك:` +
    (c.configured === false ? " (الذكاء الاصطناعي غير مُفعّل بمفتاح بعد — هذا ردّ مبدئي.)" : "") +
    `\n\nبناءً على ملخّص منشأتك:\n${summary}\n` +
    (last ? `\nبخصوص «${last.slice(0, 80)}» أنصح بمراجعة الإدارة المعنية ومؤشراتها، وتحديد هدف قابل للقياس وخطوة تنفيذية أولى.` : "");
  return Response.json({ reply, configured: c.configured });
}
