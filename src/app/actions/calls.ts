"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type CallType = "video" | "audio";
export type CallStatus = "pending" | "accepted" | "rejected" | "ended" | "missed";

export type CallInvitation = {
  id: string;
  room_name: string;
  call_type: CallType;
  caller_id: string;
  caller_name: string;
  callee_id: string;
  callee_name: string;
  status: CallStatus;
  created_at: string;
  expires_at: string;
};

export async function createCallInvitation(input: {
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  callType: CallType;
}): Promise<{ ok: boolean; invitation?: CallInvitation; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };

  const roomName = `munsha-${input.callerId.slice(0, 8)}-${input.calleeId.slice(0, 8)}-${Date.now()}`;

  const { data, error } = await sb
    .from("call_invitations")
    .insert({
      room_name: roomName,
      call_type: input.callType,
      caller_id: input.callerId,
      caller_name: input.callerName,
      callee_id: input.calleeId,
      callee_name: input.calleeName,
      status: "pending",
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, invitation: data as CallInvitation };
}

export async function updateCallStatus(
  id: string,
  status: CallStatus
): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false, error: "قاعدة البيانات غير مهيّأة" };
  const { error } = await sb.from("call_invitations").update({ status }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getPendingCallsForMember(
  memberId: string
): Promise<{ ok: boolean; calls?: CallInvitation[] }> {
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const { data } = await sb
    .from("call_invitations")
    .select("*")
    .eq("callee_id", memberId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return { ok: true, calls: (data ?? []) as CallInvitation[] };
}
