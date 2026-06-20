"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgIdOrFallback } from "@/lib/org-context";
import { Resend } from "resend";

export type EmailSettings = {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  kinds: string[];
};

export async function saveEmailSettings(settings: EmailSettings): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { data: existing } = await sb
    .from("secretary_reports")
    .select("id")
    .eq("org_id", ORG_ID)
    .eq("period", "email_settings")
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("secretary_reports")
      .update({ data: settings as unknown as Record<string, string> })
      .eq("id", existing.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { error } = await sb.from("secretary_reports").insert({
    org_id: ORG_ID,
    period: "email_settings",
    data: settings as unknown as Record<string, string>,
    narrative: "إعدادات البريد الإلكتروني",
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function loadEmailSettings(): Promise<{ ok: boolean; settings?: EmailSettings }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { data } = await sb
    .from("secretary_reports")
    .select("data")
    .eq("org_id", ORG_ID)
    .eq("period", "email_settings")
    .maybeSingle();

  if (!data?.data) return { ok: true, settings: undefined };
  return { ok: true, settings: data.data as unknown as EmailSettings };
}

export async function sendTestEmail(to: string, fromEmail?: string, fromName?: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY غير مُعيَّن" };

  const resend = new Resend(key);
  const from = fromEmail && fromName
    ? `${fromName} <${fromEmail}>`
    : (process.env.EMAIL_FROM ?? "مُلكي <noreply@mulkios.com>");

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: "🔔 رسالة اختبار من مُلكي OS",
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;padding:24px;background:#f9f9f9;border-radius:12px;max-width:480px;margin:auto">
        <h2 style="color:#C9A24B;margin-bottom:8px">مُلكي OS — إشعارات البريد</h2>
        <p style="color:#333">تم إرسال هذه الرسالة للتحقق من صحة إعداد الإشعارات.</p>
        <p style="color:#666;font-size:13px;margin-top:16px">المعرّف: <code>${Date.now()}</code></p>
        <p style="color:#999;font-size:11px;margin-top:24px">إذا لم تطلب هذا، تجاهل الرسالة.</p>
      </div>
    `,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, messageId: data?.id };
}
