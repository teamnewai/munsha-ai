export const dynamic = "force-dynamic";

import Link from "next/link";
import { getSectionDetail } from "@/app/actions/structure";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { cn } from "@/lib/utils";
import {
  Layers, Users, Building2, ArrowLeft, DoorOpen, Briefcase, Workflow,
} from "lucide-react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
function Badge({ variant = "default", className, children }: { variant?: BadgeVariant; className?: string; children: React.ReactNode }) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-border text-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ok, section, members, roles } = await getSectionDetail(id);

  if (!ok || !section) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <Card className="mulki-card p-12 text-center">
          <Layers className="size-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-semibold mb-2">لم يُعثر على هذا القسم</h2>
          <Link href="/org" className="text-primary text-sm hover:underline inline-flex items-center gap-1 mt-2"><ArrowLeft className="size-4" /> العودة إلى الهيكل</Link>
        </Card>
      </div>
    );
  }

  const c = section.deptColor;

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="space-y-5">
        {/* Header */}
        <Card className="p-6" style={{ background: `linear-gradient(to left, ${c}14, transparent)`, borderRight: `4px solid ${c}` }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-xl grid place-items-center" style={{ backgroundColor: `${c}22`, color: c }}>
                <Layers className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display">{section.name}</h1>
                <Link href={`/department/${section.deptKey}`} className="inline-flex items-center gap-1 text-xs hover:underline mt-2" style={{ color: c }}>
                  <Building2 className="size-3.5" /> {section.deptName}
                </Link>
                <div className="inline-flex items-center gap-1.5 mt-2 ms-3 rounded-full border px-2.5 py-0.5 text-[11px]">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> بيانات حقيقية
                </div>
              </div>
            </div>
            <Link href={`/department/${section.deptKey}`}>
              <Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="size-4" /> رجوع للإدارة</Button>
            </Link>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Briefcase className="size-4" />} label="المسميات" value={roles.length} color={c} />
          <Stat icon={<Users className="size-4" />} label="الموظفون" value={members.length} color={c} />
          <Stat icon={<Users className="size-4" />} label="حاضرون" value={members.filter((m) => m.present).length} color={c} />
        </div>

        {/* Roles in dept */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Briefcase className="size-4" style={{ color: c }} /> المسميات الوظيفية</h3>
            <Badge variant="outline">{roles.length}</Badge>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {roles.length === 0 && <p className="text-sm text-muted-foreground col-span-full">لا توجد مسميات بعد</p>}
            {roles.map((r) => (
              <Link key={r.id} href={`/role/${r.id}`}>
                <div className="rounded-lg border p-3 hover:border-primary/40 transition-all flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{r.title}</span>
                  <ArrowLeft className="size-3.5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Employees */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Users className="size-4" style={{ color: c }} /> موظفو الإدارة</h3>
            <Badge variant="outline">{members.length}</Badge>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد موظفون معيّنون</p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {members.map((m) => (
                <Link key={m.id} href={`/workspace/${m.id}`}>
                  <div className="rounded-lg border p-3 flex items-center gap-3 hover:border-primary/40 transition-all">
                    <div className="size-10 rounded-full text-white grid place-items-center font-bold text-sm shrink-0" style={{ backgroundColor: c }}>
                      {m.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate flex items-center gap-1.5">
                        <span className={cn("size-1.5 rounded-full", m.present ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                        {m.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{m.title || "موظف"}</div>
                    </div>
                    <DoorOpen className="size-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="flex gap-2 text-xs">
          <Link href="/workflows" className="px-3 py-1.5 rounded border hover:border-primary/40 transition-colors inline-flex items-center gap-1"><Workflow className="size-3" /> سير العمل</Link>
          <Link href="/forms" className="px-3 py-1.5 rounded border hover:border-primary/40 transition-colors">النماذج</Link>
        </div>
      </div>
    </div>
  );
}
