// مُلكي — إرسال البريد (خادمي فقط) عبر Resend. جاهز فور إضافة RESEND_API_KEY.
import "server-only";

export type SendEmailResult = { ok: boolean; configured: boolean; id?: string; error?: string };

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, configured: false };
  const from = input.from || process.env.EMAIL_FROM || "مُلكي <noreply@mulkios.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, configured: true, error: JSON.stringify(data).slice(0, 300) };
    return { ok: true, configured: true, id: data?.id };
  } catch (e) {
    return { ok: false, configured: true, error: String(e).slice(0, 200) };
  }
}

// قالب بسيط متوافق مع RTL
export function notificationEmailHtml(title: string, body: string): string {
  return `<!doctype html><html dir="rtl" lang="ar"><body style="font-family:system-ui,Arial,sans-serif;background:#0b1220;padding:24px;color:#e5e7eb">
    <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#C9A24B,#a17f33);padding:16px 24px;color:#0b1220;font-weight:700;font-size:18px">مُلكي OS</div>
      <div style="padding:24px">
        <h2 style="margin:0 0 12px;font-size:18px;color:#fff">${escapeHtml(title)}</h2>
        <p style="margin:0;line-height:1.7;color:#cbd5e1">${escapeHtml(body)}</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #1f2937;font-size:12px;color:#6b7280">هذه رسالة آلية من منصة مُلكي.</div>
    </div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
