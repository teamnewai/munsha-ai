"use client";

import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { GROUPS } from "@/lib/access-data";
import { deriveRole, ROLE_LABEL, ROLE_ICON, SECTIONS } from "@/lib/workspace";
import { enterAs } from "@/components/os-app/ImpersonationBanner";
import { toast } from "@/lib/toast";
import { Sparkles, LogIn, CheckCircle2 } from "lucide-react";

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const entity = GROUPS
    .flatMap((g) => g.members.map((m) => ({ ...m, dept: g.deptName, color: g.color })))
    .find((m) => m.id === id);

  if (!entity) {
    return <div className="p-10 text-center text-muted-foreground">لم يُعثر على هذا المكتب.</div>;
  }

  const role = deriveRole(entity.kind, entity.role);
  const sections = SECTIONS[role];
  const RIcon = ROLE_ICON[role];

  return (
    <section className="space-y-6" dir="rtl">
      {/* ترويسة المكتب */}
      <Card className="mulki-card p-6 relative overflow-hidden">
        <div className="absolute -top-10 -end-10 size-40 rounded-full blur-3xl opacity-25" style={{ backgroundColor: entity.color }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="size-12 rounded-xl grid place-items-center" style={{ backgroundColor: `${entity.color}20`, color: entity.color }}>
              <RIcon className="size-6" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">{entity.name}</h1>
              <div className="text-sm text-muted-foreground">{entity.role} · {entity.dept}</div>
              <span className="inline-block mt-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px]">{ROLE_LABEL[role]}</span>
            </div>
          </div>
          <button onClick={() => { enterAs(entity.name, entity.role, entity.kind, entity.id); toast.success(`تتصفّح الآن بصلاحيات ${entity.name}`); }}
            className="inline-flex items-center gap-2 rounded-xl mulki-gold-bg px-4 py-2.5 text-sm font-bold hover:opacity-90">
            <LogIn className="size-4" /> تصفّح بصلاحياته
          </button>
        </div>
        <div className="relative mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="size-3.5" /> هذا المكتب ولوحته أُنشئا تلقائياً من الهيكل التنظيمي المعتمد
        </div>
      </Card>

      {/* لوحة الدور (مُولّدة) */}
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
