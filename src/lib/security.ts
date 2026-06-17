// مُلكي — أدوات أمان مساعدة (المرحلة 4)

/**
 * يمنع ثغرة إعادة التوجيه المفتوح (Open Redirect).
 * يقبل فقط المسارات الداخلية النسبية (تبدأ بـ "/" وليست "//" أو بروتوكول خارجي).
 */
export function safeRedirect(path: string | null | undefined, fallback = "/dashboard"): string {
  if (!path) return fallback;
  // يجب أن يبدأ بـ "/" ولا يكون "//" (تجاوز للمضيف) ولا يحتوي على ":" (بروتوكول)
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes(":")) {
    return path;
  }
  return fallback;
}

/** إخفاء رقم الجوال (PII): يُظهر أول 3 وآخر 2 فقط */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\s+/g, "");
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 3)}••••${digits.slice(-2)}`;
}

/** إخفاء الهوية الوطنية/السجل: يُظهر آخر 3 فقط */
export function maskNationalId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 3) return id;
  return `••••••${id.slice(-3)}`;
}

/**
 * تحديد معدّل الطلبات (Rate limiting).
 * يستخدم Upstash Redis REST إن كانت المفاتيح مضبوطة؛ وإلا يسمح (no-op) —
 * تفادياً لحظر خاطئ في بيئة serverless بلا مخزن مشترك.
 * يُفعّل بإضافة UPSTASH_REDIS_REST_URL و UPSTASH_REDIS_REST_TOKEN.
 */
export async function rateLimit(
  key: string,
  limit = 30,
  windowSeconds = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { allowed: true, remaining: limit };

  try {
    // INCR ثم EXPIRE للنافذة الزمنية
    const res = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = (await res.json()) as { result: number };
    const count = data.result ?? 1;
    if (count === 1) {
      await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSeconds}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return { allowed: true, remaining: limit }; // لا نحظر عند فشل المخزن
  }
}
