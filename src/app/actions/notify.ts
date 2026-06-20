"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgIdOrFallback } from "@/lib/org-context";
import { sendEmail, notificationEmailHtml } from "@/lib/email";

export type NotifKind = "info" | "request" | "payment" | "maintenance" | "contract" | "alert";

// ينشئ إشعاراً حقيقياً في قاعدة البيانات ويُرسله بالبريد إن توفّر مستلِم ومفتاح Resend.
export async function createNotification(input: {
  title: string;
  body?: string;
  kind?: NotifKind;
  email?: string;          // إن وُجد، يُرسَل بريد أيضاً
}): Promise<{ ok: boolean; emailed: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, emailed: false, error: "قاعدة البيانات غير مهيّأة" };
  const ORG_ID = await getCurrentOrgIdOrFallback();

  const { error } = await sb.from("notifications").insert({
    org_id: ORG_ID,
    title: input.title,
    body: input.body ?? null,
    kind: input.kind ?? "info",
    is_read: false,
  });
  if (error) return { ok: false, emailed: false, error: error.message };

  let emailed = false;
  if (input.email) {
    const r = await sendEmail({
      to: input.email,
      subject: input.title,
      html: notificationEmailHtml(input.title, input.body ?? ""),
    });
    emailed = r.ok;
  }

  return { ok: true, emailed };
}
