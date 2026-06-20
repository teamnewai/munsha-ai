// مُلكي — طبقة الدفع (خادمية فقط). REOS: المنصة تُسجّل العملية ولا تحتفظ بالأموال.
// المزوّد النشط عبر PAYMENT_ACTIVE_PROVIDER (moyasar | stripe). جاهزة فور إضافة المفاتيح.
import "server-only";

export type Provider = "moyasar" | "stripe";

export type CreatePaymentInput = {
  itemKey: string;        // معرّف العنصر/الاشتراك المُباع
  amount: number;         // بالريال (وحدة رئيسية) — يُحوّل داخلياً للهللات
  currency?: string;      // SAR افتراضياً
  description?: string;
  successUrl?: string;
  callbackUrl?: string;
};

export type CreatePaymentResult =
  | { ok: true; url: string; sessionId: string; provider: Provider }
  | { ok: false; configured: boolean; error?: string };

export function activeProvider(): Provider {
  const p = (process.env.PAYMENT_ACTIVE_PROVIDER || "moyasar").toLowerCase();
  return p === "stripe" ? "stripe" : "moyasar";
}

// ─── Moyasar (افتراضي للسوق السعودي) ──────────────────────────────────────────
async function createMoyasarInvoice(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (!key) return { ok: false, configured: false };
  try {
    const res = await fetch("https://api.moyasar.com/v1/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100), // هللات
        currency: input.currency || "SAR",
        description: input.description || input.itemKey,
        callback_url: input.callbackUrl,
        success_url: input.successUrl,
        metadata: { item_key: input.itemKey },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, configured: true, error: JSON.stringify(data).slice(0, 300) };
    return { ok: true, url: data.url, sessionId: data.id, provider: "moyasar" };
  } catch (e) {
    return { ok: false, configured: true, error: String(e).slice(0, 200) };
  }
}

// ─── Stripe Checkout ──────────────────────────────────────────────────────────
async function createStripeSession(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, configured: false };
  try {
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", input.successUrl || `${process.env.NEXT_PUBLIC_APP_URL || ""}/billing?status=success`);
    form.set("cancel_url", input.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL || ""}/billing?status=cancel`);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", (input.currency || "SAR").toLowerCase());
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(input.amount * 100)));
    form.set("line_items[0][price_data][product_data][name]", input.description || input.itemKey);
    form.set("metadata[item_key]", input.itemKey);
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, configured: true, error: JSON.stringify(data).slice(0, 300) };
    return { ok: true, url: data.url, sessionId: data.id, provider: "stripe" };
  } catch (e) {
    return { ok: false, configured: true, error: String(e).slice(0, 200) };
  }
}

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  return activeProvider() === "stripe" ? createStripeSession(input) : createMoyasarInvoice(input);
}
