import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// مستقبِل إشعار الدفع من المزوّد (Moyasar/Stripe). يحدّث حالة billing_payments.
// ملاحظة: للإنتاج يُنصح بالتحقق من توقيع الـwebhook (Stripe-Signature / Moyasar secret).
export async function POST(req: Request) {
  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { /* قد يكون form-encoded */ }

  // استخراج معرّف الجلسة والحالة بشكل متوافق مع المزوّدَين
  const data = (payload?.data as Record<string, unknown>) ?? payload;
  const obj = (data?.object as Record<string, unknown>) ?? data;

  const sessionId =
    (obj?.id as string) ||
    (payload?.id as string) ||
    (obj?.invoice_id as string) ||
    "";

  const rawStatus = String(
    (obj?.status as string) ||
    (payload?.type as string) ||
    ""
  ).toLowerCase();

  const paid = ["paid", "succeeded", "checkout.session.completed", "payment_intent.succeeded"].some((s) => rawStatus.includes(s));
  const failed = ["failed", "canceled", "cancelled", "expired"].some((s) => rawStatus.includes(s));
  const status = paid ? "paid" : failed ? "failed" : "pending";

  if (sessionId) {
    const sb = createAdminClient();
    if (sb) {
      await sb.from("billing_payments").update({ status }).eq("provider_session_id", sessionId);
    }
  }

  // أعد 200 دائماً حتى لا يعيد المزوّد المحاولة بلا داعٍ
  return Response.json({ received: true, status });
}
