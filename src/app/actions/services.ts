"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// إجراءات خادمية للكتابة/القراءة الفعلية في Supabase (تتجاوز RLS عبر Service-Role).

export type ActionResult = { ok: boolean; error?: string };

async function firstOrgId(sb: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data } = await sb.from("organizations").select("id,name").limit(1).maybeSingle();
  return data as { id: string; name: string } | null;
}

/** قراءة خدمات منشأتي المحفوظة فعلياً */
export async function getOrgServices(): Promise<{ ok: boolean; orgName: string; categories: string[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, orgName: "", categories: [] };
  const { data } = await sb.from("organizations").select("name,service_categories").limit(1).maybeSingle();
  return {
    ok: true,
    orgName: (data?.name as string) ?? "",
    categories: (data?.service_categories as string[] | null) ?? [],
  };
}

/** حفظ خدمات منشأتي فعلياً في organizations.service_categories */
export async function saveOrgServices(categories: string[]): Promise<ActionResult> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة (SERVICE_ROLE)" };
  const org = await firstOrgId(sb);
  if (!org) return { ok: false, error: "لا توجد منشأة" };
  const { error } = await sb.from("organizations").update({ service_categories: categories }).eq("id", org.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** إنشاء طلب موجّه فعلي في جدول leads */
export async function submitLead(input: {
  category: string; provider: string; name: string; phone: string; details?: string; city?: string;
}): Promise<ActionResult> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة (SERVICE_ROLE)" };
  const kind = input.category === "rent" ? "unit" : "maintenance"; // قيد الجدول: unit|maintenance
  const { error } = await sb.from("leads").insert({
    kind,
    service_category: input.category,
    country: "السعودية",
    city: input.city || "غير محدد",
    status: "open",
    score: 0,
    contact_name: input.name,
    contact_phone: input.phone,
    description: `توجيه إلى منشأة: ${input.provider}${input.details ? " — " + input.details : ""}`,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type DbProvider = { name: string; city: string; specialty: string; rating: number };

/** قراءة المنشآت المزوّدة الفعلية لتصنيف معيّن */
export async function getDbProviders(category: string): Promise<DbProvider[]> {
  const sb = createAdminClient();
  if (!sb) return [];
  const { data } = await sb
    .from("organizations")
    .select("name,city,specialty,rating,service_categories")
    .contains("service_categories", [category]);
  return (data ?? []).map((o) => ({
    name: (o.name as string) ?? "منشأة",
    city: (o.city as string) ?? "—",
    specialty: (o.specialty as string) ?? "خدمة معروضة",
    rating: (o.rating as number) ?? 5,
  }));
}
