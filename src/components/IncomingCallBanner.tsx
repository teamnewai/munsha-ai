"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Phone, PhoneOff, Video, Mic } from "lucide-react";
import { updateCallStatus } from "@/app/actions/calls";
import type { CallInvitation } from "@/app/actions/calls";
import dynamic from "next/dynamic";

const VideoCallModal = dynamic(() => import("@/components/VideoCallModal"), { ssr: false });

type Props = { memberId: string; memberName: string };

export default function IncomingCallBanner({ memberId, memberName }: Props) {
  const [incoming, setIncoming] = useState<CallInvitation | null>(null);
  const [activeCall, setActiveCall] = useState<CallInvitation | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !memberId) return;

    const sb = createClient(url, key);

    const channel = sb
      .channel(`calls:${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_invitations",
          filter: `callee_id=eq.${memberId}`,
        },
        (payload) => {
          const inv = payload.new as CallInvitation;
          if (inv.status === "pending") {
            setIncoming(inv);
            audioRef.current?.play().catch(() => {});
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_invitations",
          filter: `callee_id=eq.${memberId}`,
        },
        (payload) => {
          const inv = payload.new as CallInvitation;
          if (inv.status !== "pending") setIncoming(null);
        }
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [memberId]);

  const accept = async () => {
    if (!incoming) return;
    await updateCallStatus(incoming.id, "accepted");
    setActiveCall(incoming);
    setIncoming(null);
  };

  const reject = async () => {
    if (!incoming) return;
    await updateCallStatus(incoming.id, "rejected");
    setIncoming(null);
  };

  if (!incoming && !activeCall) return null;

  return (
    <>
      {/* صوت رنين */}
      <audio ref={audioRef} src="/ring.mp3" loop />

      {/* إشعار المكالمة الواردة */}
      {incoming && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[340px] rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-4 animate-in slide-in-from-top-4" dir="rtl">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
              {incoming.caller_name[0]}
            </div>
            <div>
              <p className="font-semibold text-white">{incoming.caller_name}</p>
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                {incoming.call_type === "video"
                  ? <><Video className="size-3" /> مكالمة مرئية واردة</>
                  : <><Mic className="size-3" /> مكالمة صوتية واردة</>
                }
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={reject}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 py-2.5 text-sm font-medium hover:bg-red-500/20 transition-colors"
            >
              <PhoneOff className="size-4" /> رفض
            </button>
            <button
              onClick={accept}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white py-2.5 text-sm font-bold hover:bg-emerald-600 transition-colors"
            >
              <Phone className="size-4" /> قبول
            </button>
          </div>
        </div>
      )}

      {/* نافذة المكالمة الفعلية */}
      {activeCall && (
        <VideoCallModal
          channelName={activeCall.room_name}
          memberName={activeCall.caller_name}
          callType={activeCall.call_type}
          onClose={async () => {
            await updateCallStatus(activeCall.id, "ended");
            setActiveCall(null);
          }}
        />
      )}
    </>
  );
}
