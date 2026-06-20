"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";

export type ContactRow = {
  id: string;
  name: string;
  title: string;
  company: string;
  sector: string;
  city: string;
  specialty: string[];
  rating: number;
  connected: boolean;
  avatar: string;
};

export async function getContacts(): Promise<{ ok: boolean; contacts: ContactRow[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, contacts: [] };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: true, contacts: [] };

  const { data, error } = await sb
    .from("network_contacts")
    .select("id,name,title,company,sector,city,specialty,rating,connected,avatar")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, contacts: [] };
  return {
    ok: true,
    contacts: (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title ?? "—",
      company: c.company ?? "—",
      sector: c.sector ?? "عام",
      city: c.city ?? "—",
      specialty: c.specialty ?? [],
      rating: Number(c.rating ?? 0),
      connected: c.connected ?? false,
      avatar: c.avatar ?? c.name?.slice(0, 1) ?? "؟",
    })),
  };
}

export async function addContact(input: {
  name: string;
  title?: string;
  company?: string;
  sector?: string;
  city?: string;
  specialty?: string[];
}): Promise<{ ok: boolean; error?: string; contact?: ContactRow }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false, error: "لا توجد منشأة مرتبطة بحسابك" };

  const client = await createClient();
  const userId = client ? (await client.auth.getUser()).data.user?.id ?? null : null;

  const { data, error } = await sb
    .from("network_contacts")
    .insert({
      org_id: orgId,
      created_by: userId,
      name: input.name.trim(),
      title: input.title?.trim() || null,
      company: input.company?.trim() || null,
      sector: input.sector?.trim() || null,
      city: input.city?.trim() || null,
      specialty: input.specialty ?? [],
      avatar: input.name.trim().slice(0, 1),
    })
    .select("id,name,title,company,sector,city,specialty,rating,connected,avatar")
    .single();

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    contact: {
      id: data.id,
      name: data.name,
      title: data.title ?? "—",
      company: data.company ?? "—",
      sector: data.sector ?? "عام",
      city: data.city ?? "—",
      specialty: data.specialty ?? [],
      rating: Number(data.rating ?? 0),
      connected: data.connected ?? false,
      avatar: data.avatar ?? data.name.slice(0, 1),
    },
  };
}

export async function toggleContactConnection(id: string, connected: boolean): Promise<{ ok: boolean }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false };

  const { error } = await sb
    .from("network_contacts")
    .update({ connected })
    .eq("id", id)
    .eq("org_id", orgId);

  return { ok: !error };
}

export async function deleteContact(id: string): Promise<{ ok: boolean }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false };

  const { error } = await sb
    .from("network_contacts")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  return { ok: !error };
}
