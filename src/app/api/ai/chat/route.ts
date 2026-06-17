import { ASSISTANT_SYSTEM } from "@/lib/assistant";

export const runtime = "nodejs";

// مُلكي إدراك — مسار المساعد الذكي (السرّ يبقى على الخادم؛ المتصفّح يستدعي same-origin)
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;

  let body: { messages?: { role: string; content: string }[] } = {};
  try {
    body = await req.json();
  } catch {
    /* تجاهل */
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];

  // غير مُفعّل بعد — يرجع null فيستخدم العميل التوجيه المحلي
  if (!key) return Response.json({ reply: null, configured: false });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: ASSISTANT_SYSTEM }, ...messages],
        temperature: 0.4,
        max_tokens: 600,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return Response.json({ reply: null, configured: true, error: err.slice(0, 300) });
    }
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? null;
    return Response.json({ reply, configured: true });
  } catch (e) {
    return Response.json({ reply: null, configured: true, error: String(e) });
  }
}
