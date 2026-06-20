"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AffiliateClient = {
  id: string;
  client_name: string;
  organization_name: string;
  subscription_plan: string | null;
  subscription_status: "active" | "trial" | "inactive" | "cancelled";
  registration_date: string;
  last_activity_at: string | null;
  account_manager_name: string | null;
};

export type AffiliateManager = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  position: string | null;
  created_at: string;
};

export type AffiliateStats = {
  totalReferrals: number;
  activeClients: number;
  inactiveClients: number;
  monthlyRevenue: number;
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  commissionRate: number;
};

export type AffiliateData = {
  ok: boolean;
  isAffiliate: boolean;
  refCode: string | null;
  stats: AffiliateStats;
  clients: AffiliateClient[];
  managers: AffiliateManager[];
};

const EMPTY_STATS: AffiliateStats = {
  totalReferrals: 0, activeClients: 0, inactiveClients: 0, monthlyRevenue: 0,
  totalCommissions: 0, pendingCommissions: 0, paidCommissions: 0, commissionRate: 15,
};

// يطبّع حالة الاشتراك إلى القيم المعروضة في الواجهة
function normStatus(s: string | null): AffiliateClient["subscription_status"] {
  const v = (s || "").toLowerCase();
  if (v === "active" || v === "paid") return "active";
  if (v === "trial" || v === "trialing") return "trial";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return "inactive";
}

// يقرأ بيانات الشريك التابع الحقيقية للمستخدم الحالي من قاعدة البيانات
export async function getAffiliateData(): Promise<AffiliateData> {
  const sb = await createClient();
  if (!sb) return { ok: false, isAffiliate: false, refCode: null, stats: EMPTY_STATS, clients: [], managers: [] };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, isAffiliate: false, refCode: null, stats: EMPTY_STATS, clients: [], managers: [] };

  const admin = createAdminClient();
  if (!admin) return { ok: false, isAffiliate: false, refCode: null, stats: EMPTY_STATS, clients: [], managers: [] };

  // سجل الشريك المرتبط بالمستخدم الحالي
  const { data: aff } = await admin
    .from("affiliates")
    .select("id,ref_code,full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!aff) {
    // المستخدم ليس شريكاً مسجّلاً بعد — نعيد حالة فارغة صريحة
    return { ok: true, isAffiliate: false, refCode: null, stats: EMPTY_STATS, clients: [], managers: [] };
  }

  const affiliateId = aff.id as string;

  // المنشآت المُحالة عبر هذا الشريك + العمولات + المندوبون التابعون له
  const [orgsRes, commRes, subRes] = await Promise.all([
    admin.from("organizations")
      .select("id,name,created_at,verification_status,account_manager_name")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false }),
    admin.from("affiliate_commissions")
      .select("amount_sar,status,created_at")
      .eq("affiliate_id", affiliateId),
    admin.from("affiliates")
      .select("id,full_name,email,phone,created_at")
      .eq("supervisor_id", affiliateId)
      .order("created_at", { ascending: false }),
  ]);

  const orgs = (orgsRes.data ?? []) as { id: string; name: string; created_at: string; verification_status: string | null; account_manager_name: string | null }[];
  const orgIds = orgs.map((o) => o.id);

  // باقات الاشتراك للمنشآت المُحالة
  const planByOrg: Record<string, { plan: string | null; status: string | null }> = {};
  if (orgIds.length > 0) {
    const { data: subs } = await admin
      .from("billing_subscriptions")
      .select("org_id,plan,status")
      .in("org_id", orgIds);
    for (const s of (subs ?? []) as { org_id: string; plan: string | null; status: string | null }[]) {
      planByOrg[s.org_id] = { plan: s.plan, status: s.status };
    }
  }

  const clients: AffiliateClient[] = orgs.map((o) => {
    const sub = planByOrg[o.id];
    return {
      id: o.id,
      client_name: o.account_manager_name || o.name,
      organization_name: o.name,
      subscription_plan: sub?.plan ?? null,
      subscription_status: sub ? normStatus(sub.status) : (o.verification_status === "verified" ? "active" : "inactive"),
      registration_date: o.created_at,
      last_activity_at: null,
      account_manager_name: o.account_manager_name,
    };
  });

  // العمولات الحقيقية
  const comms = (commRes.data ?? []) as { amount_sar: number | null; status: string | null; created_at: string }[];
  const sum = (pred: (s: string) => boolean) => comms.filter((c) => pred((c.status || "").toLowerCase())).reduce((t, c) => t + Number(c.amount_sar ?? 0), 0);
  const totalCommissions = comms.reduce((t, c) => t + Number(c.amount_sar ?? 0), 0);
  const paidCommissions = sum((s) => s === "paid");
  const pendingCommissions = sum((s) => s === "pending" || s === "");
  const now = new Date();
  const monthlyRevenue = comms
    .filter((c) => { const d = new Date(c.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((t, c) => t + Number(c.amount_sar ?? 0), 0);

  const activeClients = clients.filter((c) => c.subscription_status === "active" || c.subscription_status === "trial").length;

  const managers: AffiliateManager[] = ((subRes.data ?? []) as { id: string; full_name: string | null; email: string | null; phone: string | null; created_at: string }[])
    .map((m) => ({ id: m.id, name: m.full_name || "—", email: m.email || "—", mobile: m.phone, position: "مندوب تابع", created_at: m.created_at }));

  return {
    ok: true,
    isAffiliate: true,
    refCode: aff.ref_code ?? null,
    stats: {
      totalReferrals: clients.length,
      activeClients,
      inactiveClients: clients.length - activeClients,
      monthlyRevenue,
      totalCommissions,
      pendingCommissions,
      paidCommissions,
      commissionRate: 15,
    },
    clients,
    managers,
  };
}
