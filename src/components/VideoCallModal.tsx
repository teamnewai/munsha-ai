"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";
import { Video, VideoOff, Mic, MicOff, PhoneOff } from "lucide-react";
import { updateCallStatus } from "@/app/actions/calls";

type Props = {
  channelName: string;
  memberName: string;
  memberEmail?: string;
  callType?: "video" | "audio";
  invitationId?: string;
  isWaiting?: boolean;        // المتصل ينتظر الرد
  onClose: () => void;
};

export default function VideoCallModal({
  channelName,
  memberName,
  callType = "video",
  invitationId,
  isWaiting = false,
  onClose,
}: Props) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const localTracksRef = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);

  const [connected, setConnected] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [camOn, setCamOn] = useState(callType === "video");
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(isWaiting);

  const startCall = useCallback(async () => {
    try {
      const res = await fetch("/api/video/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "فشل الاتصال"); return; }

      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || data.appId;
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        setWaiting(false);
        if (mediaType === "video" && remoteVideoRef.current) {
          setRemoteJoined(true);
          user.videoTrack?.play(remoteVideoRef.current);
        }
        if (mediaType === "audio") {
          (user.audioTrack as IRemoteAudioTrack)?.play();
        }
      });

      client.on("user-unpublished", (_, mediaType) => {
        if (mediaType === "video") setRemoteJoined(false);
      });

      await client.join(appId, channelName, data.token, data.uid);

      const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
      let camTrack: ICameraVideoTrack | null = null;

      if (callType === "video") {
        camTrack = await AgoraRTC.createCameraVideoTrack();
        localTracksRef.current = [micTrack, camTrack];
        if (localVideoRef.current) camTrack.play(localVideoRef.current);
        await client.publish([micTrack, camTrack]);
      } else {
        localTracksRef.current = [micTrack, camTrack as unknown as ICameraVideoTrack];
        await client.publish([micTrack]);
      }

      setConnected(true);
    } catch (e) {
      setError(String(e).slice(0, 150));
    }
  }, [channelName, callType]);

  useEffect(() => { startCall(); return () => { doEnd(false); }; }, [startCall]);

  const doEnd = async (notify = true) => {
    localTracksRef.current?.[0]?.close();
    localTracksRef.current?.[1]?.close();
    await clientRef.current?.leave();
    if (notify && invitationId) await updateCallStatus(invitationId, "ended");
    onClose();
  };

  const toggleCam = async () => {
    const track = localTracksRef.current?.[1];
    if (!track) return;
    await track.setEnabled(!camOn);
    setCamOn(!camOn);
  };

  const toggleMic = async () => {
    const track = localTracksRef.current?.[0];
    if (!track) return;
    await track.setEnabled(!micOn);
    setMicOn(!micOn);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center" dir="rtl">
      {/* Header */}
      <div className="absolute top-4 right-4 left-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-white font-bold">
            {memberName[0]}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{memberName}</p>
            <p className="text-zinc-400 text-xs">
              {waiting ? "جارٍ الاتصال..." : connected ? (remoteJoined ? "متصل" : "في انتظار الانضمام...") : "جارٍ الاتصال..."}
            </p>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${
          callType === "video" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"
        }`}>
          {callType === "video" ? "مرئي" : "صوتي"}
        </span>
      </div>

      {/* Video / Audio area */}
      {callType === "video" ? (
        <div className="relative w-full max-w-4xl aspect-video bg-zinc-900 rounded-2xl overflow-hidden">
          <div ref={remoteVideoRef} className="absolute inset-0" />

          {/* Waiting overlay */}
          {(waiting || !remoteJoined) && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
              <div className="text-center">
                <div className="size-24 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4 ring-4 ring-primary/30 animate-pulse">
                  <span className="text-4xl font-bold text-white">{memberName[0]}</span>
                </div>
                <p className="text-white font-semibold">{memberName}</p>
                <p className="text-zinc-400 text-sm mt-1">
                  {waiting ? "جارٍ الاتصال..." : "في انتظار الانضمام..."}
                </p>
              </div>
            </div>
          )}

          {/* Local PiP */}
          {callType === "video" && (
            <div ref={localVideoRef} className="absolute bottom-4 left-4 w-36 aspect-video rounded-xl overflow-hidden border-2 border-white/20 bg-zinc-800" />
          )}
        </div>
      ) : (
        /* Audio-only screen */
        <div className="flex flex-col items-center gap-6">
          <div className="size-32 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border-4 border-emerald-500/30 flex items-center justify-center animate-pulse">
            <span className="text-5xl font-bold text-white">{memberName[0]}</span>
          </div>
          <div className="text-center">
            <p className="text-white text-xl font-semibold">{memberName}</p>
            <p className="text-zinc-400 text-sm mt-1">
              {waiting ? "جارٍ الاتصال..." : connected ? "متصل — مكالمة صوتية" : "جارٍ الاتصال..."}
            </p>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-red-400 text-sm text-center max-w-sm">{error}</p>}

      {/* Controls */}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={toggleMic}
          className={`size-14 rounded-full flex items-center justify-center transition-colors ${
            micOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 text-white"
          }`}
          title={micOn ? "كتم الميكروفون" : "تشغيل الميكروفون"}
        >
          {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </button>

        <button
          onClick={() => doEnd(true)}
          className="size-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
          title="إنهاء المكالمة"
        >
          <PhoneOff className="size-6" />
        </button>

        {callType === "video" && (
          <button
            onClick={toggleCam}
            className={`size-14 rounded-full flex items-center justify-center transition-colors ${
              camOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 text-white"
            }`}
            title={camOn ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}
          >
            {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
