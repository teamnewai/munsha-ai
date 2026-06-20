"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// معرّف فارغ (sentinel) لا يطابق أي صف — لا يعتمد على أي منشأة فعلية.
// يُستخدم فقط حين لا توجد جلسة/عضوية، فتعود الاستعلامات فارغة (حالة «تجريبي»).
const NULL_ORG_ID = "00000000-0000-0000-0000-000000000000";

/**
 * يُرجع معرّف منشأة المستخدم الحالي (من جلسته)، لضمان أن كل صاحب منشأة
 * يرى بياناته فقط. يُحلّل المنشأة من جدول memberships حسب user_id.
 *
 * - لا جلسة / لا مفاتيح / بلا عضوية → null (يُعرض عادةً وضع «تجريبي» أو onboarding).
 * - لا يعتمد إطلاقاً على أي منشأة مثبّتة في الكود.
 */
export async function getCurrentOrgId(): Promise<string | null> {
  const sb = await createClient();
  if (!sb) return null;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.org_id ?? null;
}

/** نسخة لا تُرجع null أبداً — تتراجع لمعرّف فارغ لا يطابق شيئاً (لا منشأة وهمية). */
export async function getCurrentOrgIdOrFallback(): Promise<string> {
  return (await getCurrentOrgId()) ?? NULL_ORG_ID;
}
