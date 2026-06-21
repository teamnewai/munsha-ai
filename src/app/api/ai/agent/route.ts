import { callClaude, sanitizeMessages } from "@/lib/ai";
import { deptKnowledge } from "@/lib/deptKnowledge";

export const runtime = "nodejs";

// مُلكي — محادثة وكيل القسم: يجيب ضمن سياق مهام/سياسات/حوكمة الإدارة.
export async function POST(req: Request) {
  let body: { deptKey?: string; deptName?: string; agentName?: string; messages?: unknown } = {};
  try { body = await req.json(); } catch { /* تجاهل */ }

  const deptName = (body.deptName || "الإدارة").slice(0, 120);
  const agentName = (body.agentName || `وكيل ${deptName}`).slice(0, 120);
  const messages = sanitizeMessages(body.messages);
  const k = deptKnowledge(body.deptKey || "", deptName);

  const system = `أنت «${agentName}»، وكيل ذكاء اصطناعي مسؤول عن إدارة «${deptName}» داخل منصّة مُلكي لتشغيل الأعمال.
مهامك وواجباتك: ${k.duties.join("، ")}.
الدورة المستندية: ${k.documentCycle.join(" ← ")}.
السياسات الداخلية: ${k.policies.join("، ")}.
الحوكمة: ${k.governance.join("، ")}.
أجب بالعربية بإيجاز ومهنية، ضمن نطاق هذه الإدارة فقط، واقترح خطوات عملية قابلة للتنفيذ. إن كان السؤال خارج اختصاصك، وجّه المستخدم للإدارة المناسبة بأدب.`;

  const c = await callClaude(system, messages, { maxTokens: 700, temperature: 0.5 });
  if (c.ok) return Response.json({ reply: c.text, configured: true });

  // ردّ احتياطي (بلا مفتاح) — مفيد ضمن حدود معرفة القسم
  const last = messages[messages.length - 1]?.content ?? "";
  const reply =
    `أنا ${agentName}.` +
    (c.configured === false ? " (الذكاء الاصطناعي غير مُفعّل بمفتاح بعد — هذا ردّ تعريفي مبدئي.)" : "") +
    `\n\nأختصّ بـ: ${k.duties.slice(0, 3).join("، ")}.` +
    (last ? `\nبخصوص طلبك، أقترح اتّباع الدورة المستندية: ${k.documentCycle.join(" ← ")}.` : "");
  return Response.json({ reply, configured: c.configured });
}
