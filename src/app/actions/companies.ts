"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/org-context";

export type CompanyType = "شريك" | "عميل" | "مورّد" | "مستثمر";
export type CompanyRow = {
  id: string;
  name: string;
  type: CompanyType;
  sector: string;
  city: string;
  phone: string;
  website: string;
  employees: number;
  rating: number;
  since: number;
  active: boolean;
};

// يقرأ دليل شركاء/عملاء المنشأة الحالية فقط (عزل صارم). بلا منشأة → قائمة فارغة.
export async function getCompanies(): Promise<{ ok: boolean; companies: CompanyRow[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, companies: [] };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: true, companies: [] };

  const { data, error } = await sb
    .from("partner_companies")
    .select("id,name,type,sector,city,phone,website,employees,rating,since,active")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, companies: [] };
  return {
    ok: true,
    companies: (data ?? []).map((c) => ({
      id: c.id, name: c.name, type: (c.type as CompanyType) ?? "شريك",
      sector: c.sector ?? "—", city: c.city ?? "—", phone: c.phone ?? "—",
      website: c.website ?? "—", employees: c.employees ?? 0, rating: Number(c.rating ?? 0),
      since: c.since ?? new Date().getFullYear(), active: c.active ?? true,
    })),
  };
}

export async function addCompany(input: {
  name: string; type: CompanyType; sector?: string; city?: string; phone?: string; website?: string;
}): Promise<{ ok: boolean; error?: string; company?: CompanyRow }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false, error: "لا توجد منشأة مرتبطة بحسابك" };
  if (!input.name.trim()) return { ok: false, error: "اسم الشركة مطلوب" };

  const { data, error } = await sb
    .from("partner_companies")
    .insert({
      org_id: orgId,
      name: input.name.trim(),
      type: input.type,
      sector: input.sector?.trim() || null,
      city: input.city?.trim() || null,
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      since: new Date().getFullYear(),
    })
    .select("id,name,type,sector,city,phone,website,employees,rating,since,active")
    .single();

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    company: {
      id: data.id, name: data.name, type: data.type as CompanyType,
      sector: data.sector ?? "—", city: data.city ?? "—", phone: data.phone ?? "—",
      website: data.website ?? "—", employees: data.employees ?? 0, rating: Number(data.rating ?? 0),
      since: data.since ?? new Date().getFullYear(), active: data.active ?? true,
    },
  };
}
