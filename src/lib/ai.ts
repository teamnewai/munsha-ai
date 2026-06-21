// مُلكي — مساعد استدعاء Claude (خادمي فقط). مفتاح واحد ANTHROPIC_API_KEY لكل ميزات الـAI.
import "server-only";

type Msg = { role: string; content: string };
export type ClaudeResult =
  | { ok: true; text: string }
  | { ok: false; configured: boolean; error?: string };

// حدود إدخال صارمة لمنع إساءة استخدام نقاط الـAI (تكلفة/حجم الطلب).
const MAX_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 8000;

/**
 * يُنقّي مصفوفة رسائل واردة من العميل (غير موثوقة): يتحقق من النوع،
 * ويحدّ العدد بآخر MAX_MESSAGES رسالة، ويقصّ طول كل رسالة.
 */
export function sanitizeMessages(raw: unknown): Msg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Msg => !!m && typeof m === "object" && typeof (m as Msg).content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.slice(0, MAX_CHARS_PER_MESSAGE),
    }))
    .filter((m) => m.content.trim().length > 0);
}

export async function callClaude(
  system: string,
  messages: Msg[],
  opts?: { model?: string; maxTokens?: number; temperature?: number }
): Promise<ClaudeResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, configured: false };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts?.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        max_tokens: opts?.maxTokens ?? 800,
        ...(opts?.temperature != null ? { temperature: opts.temperature } : {}),
        system,
        messages: messages
          .filter((m) => m.content?.trim())
          .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      }),
    });
    if (!res.ok) return { ok: false, configured: true, error: (await res.text()).slice(0, 300) };
    const data = await res.json();
    return { ok: true, text: data?.content?.[0]?.text ?? "" };
  } catch (e) {
    return { ok: false, configured: true, error: String(e).slice(0, 200) };
  }
}
