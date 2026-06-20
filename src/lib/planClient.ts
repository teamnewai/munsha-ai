import { createClient } from "@/lib/supabase/client";
import { getPlan, type Plan } from "@/lib/plans";

// مُلكي إدراك — قراءة باقة المنشأة وفرض الحدود (من جهة العميل)
// ملاحظة: هذا فرضٌ على مستوى تجربة الاستخدام (UX gating)، لا حاجزٌ أمني.
// الحاجز النهائي يبقى RLS؛ ويمكن لاحقاً إضافة Trigger على مستوى القاعدة.

export interface PlanUsage {
  plan: Plan;
  users: number;
  properties: number;
}

/** يقرأ باقة المنشأة الحالية واستهلاكها. */
export async function getPlanUsage(orgId: string): Promise<PlanUsage> {
  const supabase = createClient()!;
  const [{ data: sub }, users, props] = await Promise.all([
    supabase.from("subscriptions").select("current_tier").eq("org_id", orgId).maybeSingle(),
    supabase.from("dept_members").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);
  return {
    plan: getPlan((sub as { current_tier: string } | null)?.current_tier),
    users: users.count ?? 0,
    properties: props.count ?? 0,
  };
}

/**
 * المرحلة الحالية: كل الميزات متاحة للجميع بلا قيود باقات أو اشتراك مدفوع.
 * نُبقي التوقيع كما هو حتى لا تتأثّر مواضع الاستدعاء، لكنه لا يفرض أي حدّ.
 */
export async function checkLimit(_orgId: string, _resource: "users" | "properties"): Promise<string | null> {
  void _orgId; void _resource;
  return null;
}
