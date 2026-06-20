import { createPayment, activeProvider } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgIdOrFallback } from "@/lib/org-context";

export const runtime = "nodejs";

// إنشاء عملية دفع: يسجّل صفّاً في billing_payments ثم يعيد رابط الدفع من المزوّد.
export async function POST(req: Request) {
  let body: { itemKey?: string; amount?: number; currency?: string; description?: string } = {};
  try { body = await req.json(); } catch { /* تجاهل */ }

  const itemKey = (body.itemKey || "").trim();
  const amount = Number(body.amount);
  if (!itemKey || !amount || amount <= 0) {
    return Response.json({ ok: false, error: "itemKey و amount مطلوبان" }, { status: 400 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const result = await createPayment({
    itemKey,
    amount,
    currency: body.currency || "SAR",
    description: body.description || itemKey,
    successUrl: `${origin}/billing?status=success`,
    callbackUrl: `${origin}/api/payments/webhook`,
  });

  if (!result.ok) {
    // المزوّد غير مُفعّل بعد (لا مفتاح) — أرجع إشارة واضحة للواجهة
    return Response.json({ ok: false, configured: result.configured, error: result.error ?? "بوابة الدفع غير مُفعّلة" }, { status: result.configured ? 502 : 200 });
  }

  // سجّل العملية كـ pending
  const sb = createAdminClient();
  if (sb) {
    const ORG_ID = await getCurrentOrgIdOrFallback();
    await sb.from("billing_payments").insert({
      org_id: ORG_ID,
      item_key: itemKey,
      amount,
      currency: body.currency || "SAR",
      provider: result.provider,
      provider_session_id: result.sessionId,
      status: "pending",
    });
  }

  return Response.json({ ok: true, url: result.url, sessionId: result.sessionId, provider: result.provider });
}

export async function GET() {
  return Response.json({ provider: activeProvider(), ready: !!(process.env.MOYASAR_SECRET_KEY || process.env.STRIPE_SECRET_KEY) });
}
