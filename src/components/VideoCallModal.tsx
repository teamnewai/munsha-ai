"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Maximize2 } from "lucide-react";

type Props = {
  channelName: string;
  memberName: string;
  memberEmail?: string;
  onClose: () => void;
};

type ConnectionState = "idle" | "connecting" | "connected" | "error";

export default function VideoCallModal({ channelName, memberName, onClose }: Props) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<ConnectionState>("idle");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [error, setError] = useState("");

  const localTracksRef = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);

  const startCall = useCallback(async () => {
    setState("connecting");
    try {
      const res = await fetch("/api/video/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "فشل الاتصال"); setState("error"); return; }

      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || data.appId;
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
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

      const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      localTracksRef.current = [micTrack, camTrack];

      if (localVideoRef.current) camTrack.play(localVideoRef.current);
      await client.publish([micTrack, camTrack]);

      setState("connected");
    } catch (e) {
      setError(String(e));
      setState("error");
    }
  }, [channelName]);

  useEffect(() => { startCall(); return () => { endCall(); }; }, [startCall]);

  const endCall = async () => {
    localTracksRef.current?.[0]?.close();
    localTracksRef.current?.[1]?.close();
    await clientRef.current?.leave();
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
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center" dir="rtl">
      {/* Header */}
      <div className="absolute top-4 right-4 left-4 flex items-center justify-between">
        <span className="text-white font-display text-lg font-semibold">{memberName}</span>
        <span className={`text-xs px-2 py-1 rounded-full ${
          state === "connected" ? "bg-emerald-500/20 text-emerald-400" :
          state === "connecting" ? "bg-amber-500/20 text-amber-400" :
          "bg-red-500/20 text-red-400"
        }`}>
          {state === "connected" ? "متصل" : state === "connecting" ? "جارٍ الاتصال..." : "خطأ"}
        </span>
      </div>

      {/* Video area */}
      <div className="relative w-full max-w-4xl aspect-video bg-zinc-900 rounded-2xl overflow-hidden">
        {/* Remote video */}
        <div ref={remoteVideoRef} className="absolute inset-0" />
        {!remoteJoined && state === "connected" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="size-20 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl font-bold text-white">{memberName[0]}</span>
              </div>
              <p className="text-zinc-400 text-sm">في انتظار {memberName}...</p>
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <div
          ref={localVideoRef}
          className="absolute bottom-4 left-4 w-36 aspect-video rounded-xl overflow-hidden border-2 border-white/20 bg-zinc-800"
        />

        {!camOn && (
          <div className="absolute bottom-4 left-4 w-36 aspect-video rounded-xl bg-zinc-800 flex items-center justify-center border-2 border-white/20">
            <VideoOff className="size-6 text-zinc-500" />
          </div>
        )}
      </div>

      {/* Error */}
      {state === "error" && (
        <p className="mt-4 text-red-400 text-sm">{error}</p>
      )}

      {/* Controls */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={toggleMic}
          className={`size-14 rounded-full flex items-center justify-center transition-colors ${
            micOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 text-white"
          }`}
        >
          {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </button>

        <button
          onClick={endCall}
          className="size-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
        >
          <PhoneOff className="size-6" />
        </button>

        <button
          onClick={toggleCam}
          className={`size-14 rounded-full flex items-center justify-center transition-colors ${
            camOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 text-white"
          }`}
        >
          {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
        </button>
      </div>

      <p className="mt-3 text-zinc-500 text-xs">
        <Maximize2 className="size-3 inline me-1" />
        الغرفة: {channelName}
      </p>
    </div>
  );
}
