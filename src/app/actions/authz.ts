"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// بوابة التحقق من صلاحية الدخول — منصّة داخلية: لا يدخل إلا المصرّح لهم.
// مسموح بالدخول إذا:
//  1) البريد ضمن قائمة المالكين الموثوقة (AUTH_ALLOWLIST)
//  2) للمستخدم عضوية في منشأة (memberships)
//  3) بريده مسجّل كموظف معتمد (dept_members) وغير موقوف
export async function authorizeUser(input: {
  userId: string;
  email: string | null | undefined;
}): Promise<{ authorized: boolean; reason?: string }> {
  const email = (input.email ?? "").trim().toLowerCase();

  // 1) قائمة المالكين الموثوقة
  const allow = (process.env.AUTH_ALLOWLIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (email && allow.includes(email)) return { authorized: true };

  const sb = createAdminClient();
  if (!sb) return { authorized: true }; // وضع تجريبي بلا قاعدة بيانات → لا نمنع

  // 2) عضوية في منشأة
  const { count: memberCount } = await sb
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId);
  if (memberCount && memberCount > 0) return { authorized: true };

  // 3) موظف معتمد بالبريد
  if (email) {
    const { data: emp } = await sb
      .from("dept_members")
      .select("id, suspended, user_id")
      .ilike("email", email)
      .maybeSingle();
    if (emp && !emp.suspended) {
      // ربط user_id بالموظف عند أول دخول
      if (!emp.user_id) {
        await sb.from("dept_members").update({ user_id: input.userId }).eq("id", emp.id);
      }
      return { authorized: true };
    }
    if (emp && emp.suspended) {
      return { authorized: false, reason: "suspended" };
    }
  }

  return { authorized: false, reason: "not_authorized" };
}
