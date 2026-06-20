"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { deriveRole, ROLE_LABEL, ROLE_ICON, SECTIONS } from "@/lib/workspace";
import { enterAs } from "@/components/os-app/ImpersonationBanner";
import { toast } from "@/lib/toast";
import { Sparkles, LogIn, CheckCircle2, Video, Phone } from "lucide-react";
import type { RealMember } from "@/app/actions/access";
import dynamic from "next/dynamic";

const VideoCallModal = dynamic(() => import("@/components/VideoCallModal"), { ssr: false });

type Props = {
  member: RealMember & { dept: string; color: string };
};

export default function WorkspaceClient({ member }: Props) {
  const role = deriveRole("employee", member.role);
  const sections = SECTIONS[role];
  const RIcon = ROLE_ICON[role];
  const grantCount = Object.values(member.perms).filter((g) => g.granted).length;

  const [callType, setCallType] = useState<"video" | "audio" | null>(null);

  const channelName = `munsha-${member.id.slice(0, 8)}`;

  const startCall = (type: "video" | "audio") => {
    setCallType(type);
  };

  return (
    <section className="space-y-6" dir="rtl">
      {callType && (
        <VideoCallModal
          channelName={channelName}
          memberName={member.name}
          memberEmail={member.email}
          onClose={() => setCallType(null)}
        />
      )}

      <Card className="mulki-card p-6 relative overflow-hidden">
        <div className="absolute -top-10 -end-10 size-40 rounded-full blur-3xl opacity-25" style={{ backgroundColor: member.color }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="size-12 rounded-xl grid place-items-center" style={{ backgroundColor: `${member.color}20`, color: member.color }}>
              <RIcon className="size-6" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">{member.name}</h1>
              <div className="text-sm text-muted-foreground">{member.role} · {member.dept}</div>
              <span className="inline-block mt-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px]">{ROLE_LABEL[role]}</span>
              {grantCount > 0 && (
                <span className="inline-block mt-1 ms-2 rounded-full bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 text-[11px]">{grantCount} صلاحية ممنوحة</span>
              )}
              {member.suspended && (
                <span className="inline-block mt-1 ms-2 rounded-full bg-destructive/15 text-destructive px-2.5 py-0.5 text-[11px]">موقوف</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!member.suspended && (
              <>
                <button
                  onClick={() => startCall("audio")}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                >
                  <Phone className="size-4" /> اتصال صوتي
                </button>
                <button
                  onClick={() => startCall("video")}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-2 text-sm font-medium hover:bg-blue-500/20 transition-colors"
                >
                  <Video className="size-4" /> اتصال مرئي
                </button>
                <button
                  onClick={() => { enterAs(member.name, member.role, "employee", member.id); toast.success(`تتصفّح الآن بصلاحيات ${member.name}`); }}
                  className="inline-flex items-center gap-2 rounded-xl mulki-gold-bg px-4 py-2.5 text-sm font-bold hover:opacity-90"
                >
                  <LogIn className="size-4" /> تصفّح بصلاحياته
                </button>
              </>
            )}
          </div>
        </div>

        {member.email && (
          <div className="relative mt-3 text-xs text-muted-foreground">
            البريد: <span className="text-primary">{member.email}</span>
          </div>
        )}

        <div className="relative mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="size-3.5" /> بيانات حقيقية من قاعدة البيانات — هذا المكتب أُنشئ تلقائياً من الهيكل التنظيمي المعتمد
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title} className="mulki-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="size-9 rounded-lg bg-primary/15 text-primary grid place-items-center"><Icon className="size-4" /></span>
                <h3 className="font-display font-semibold">{s.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {s.lines.map((l) => (
                  <li key={l} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-primary/60" /> {l}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" />
        القائمة الجانبية تتكيّف تلقائياً حسب دور هذا المكتب وصلاحياته عند الدخول بصلاحياته.
      </div>
    </section>
  );
}
