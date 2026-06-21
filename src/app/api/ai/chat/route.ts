import { ASSISTANT_SYSTEM } from "@/lib/assistant";
import { callClaude, sanitizeMessages } from "@/lib/ai";

export const runtime = "nodejs";

// مُلكي — المساعد الذكي: Claude أولاً (ANTHROPIC_API_KEY)، ثم OpenAI احتياطاً.
export async function POST(req: Request) {
  let body: { messages?: unknown } = {};
  try { body = await req.json(); } catch { /* تجاهل */ }
  const messages = sanitizeMessages(body.messages);

  // 1) Claude
  const c = await callClaude(ASSISTANT_SYSTEM, messages, { maxTokens: 600, temperature: 0.4 });
  if (c.ok) return Response.json({ reply: c.text, configured: true, provider: "claude" });

  // 2) احتياط: OpenAI إن وُجد مفتاحه
  const okey = process.env.OPENAI_API_KEY;
  if (okey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${okey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: ASSISTANT_SYSTEM }, ...messages],
          temperature: 0.4,
          max_tokens: 600,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return Response.json({ reply: data?.choices?.[0]?.message?.content ?? null, configured: true, provider: "openai" });
      }
    } catch { /* تجاهل */ }
  }

  // غير مُفعّل → العميل يستخدم التوجيه المحلي
  return Response.json({ reply: null, configured: false });
}
