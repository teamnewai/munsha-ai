"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// معرّف المنشأة التجريبية القديمة — يُستخدم كحل احتياطي فقط عند غياب الجلسة (للتوافق).
const FALLBACK_ORG_ID = "913b770d-4eee-4c65-8f89-8781f6593b3a";

/**
 * يُرجع معرّف منشأة المستخدم الحالي (من جلسته)، لضمان أن كل صاحب منشأة
 * يرى بياناته فقط. يُحلّل المنشأة من جدول memberships حسب user_id.
 *
 * - إن لم تكن هناك جلسة (بناء/وضع تجريبي) → يُرجع المنشأة الاحتياطية للتوافق.
 * - إن كان المستخدم بلا عضوية → يُرجع null (يُوجَّه عادةً إلى onboarding).
 */
export async function getCurrentOrgId(): Promise<string | null> {
  const sb = await createClient();
  if (!sb) return FALLBACK_ORG_ID; // وضع تجريبي بلا مفاتيح

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return FALLBACK_ORG_ID; // لا جلسة → توافق

  const admin = createAdminClient();
  if (!admin) return FALLBACK_ORG_ID;

  const { data } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.org_id ?? null;
}

/** نسخة لا تُرجع null أبداً (تتراجع للمنشأة الاحتياطية) — لمواضع لا تحتمل null. */
export async function getCurrentOrgIdOrFallback(): Promise<string> {
  return (await getCurrentOrgId()) ?? FALLBACK_ORG_ID;
}
