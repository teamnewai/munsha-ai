"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";

export type ConferenceRow = {
  id: string;
  name: string;
  organizer: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  sector: string;
  attendees: number;
  status: "upcoming" | "ongoing" | "past";
  website: string;
  featured: boolean;
};

function deriveStatus(start: string, end: string): "upcoming" | "ongoing" | "past" {
  const now = new Date().toISOString().slice(0, 10);
  if (start > now) return "upcoming";
  if (end < now) return "past";
  return "ongoing";
}

export async function getConferences(): Promise<{ ok: boolean; conferences: ConferenceRow[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, conferences: [] };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: true, conferences: [] };

  const { data, error } = await sb
    .from("org_conferences")
    .select("id,name,organizer,city,country,start_date,end_date,sector,attendees,website,featured")
    .eq("org_id", orgId)
    .order("start_date", { ascending: true });

  if (error) return { ok: false, conferences: [] };
  return {
    ok: true,
    conferences: (data ?? []).map((c) => {
      const start = c.start_date ?? new Date().toISOString().slice(0, 10);
      const end = c.end_date ?? start;
      return {
        id: c.id,
        name: c.name,
        organizer: c.organizer ?? "—",
        city: c.city ?? "—",
        country: c.country ?? "المملكة العربية السعودية",
        startDate: start,
        endDate: end,
        sector: c.sector ?? "عام",
        attendees: c.attendees ?? 0,
        status: deriveStatus(start, end),
        website: c.website ?? "—",
        featured: c.featured ?? false,
      };
    }),
  };
}

export async function addConference(input: {
  name: string;
  organizer?: string;
  city?: string;
  country?: string;
  sector?: string;
  startDate: string;
  endDate?: string;
  website?: string;
}): Promise<{ ok: boolean; error?: string; conference?: ConferenceRow }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false, error: "لا توجد منشأة مرتبطة بحسابك" };

  const client = await createClient();
  const userId = client ? (await client.auth.getUser()).data.user?.id ?? null : null;

  const end = input.endDate || input.startDate;
  const { data, error } = await sb
    .from("org_conferences")
    .insert({
      org_id: orgId,
      created_by: userId,
      name: input.name.trim(),
      organizer: input.organizer?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country?.trim() || "المملكة العربية السعودية",
      sector: input.sector?.trim() || "عام",
      start_date: input.startDate,
      end_date: end,
      website: input.website?.trim() || null,
    })
    .select("id,name,organizer,city,country,start_date,end_date,sector,attendees,website,featured")
    .single();

  if (error) return { ok: false, error: error.message };
  const start = data.start_date;
  const endDate = data.end_date ?? start;
  return {
    ok: true,
    conference: {
      id: data.id,
      name: data.name,
      organizer: data.organizer ?? "—",
      city: data.city ?? "—",
      country: data.country ?? "المملكة العربية السعودية",
      startDate: start,
      endDate,
      sector: data.sector ?? "عام",
      attendees: data.attendees ?? 0,
      status: deriveStatus(start, endDate),
      website: data.website ?? "—",
      featured: data.featured ?? false,
    },
  };
}

export async function deleteConference(id: string): Promise<{ ok: boolean }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const orgId = await getCurrentOrgId();
  if (!orgId) return { ok: false };

  const { error } = await sb
    .from("org_conferences")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  return { ok: !error };
}
