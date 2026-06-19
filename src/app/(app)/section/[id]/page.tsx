"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { cn } from "@/lib/utils";
import {
  Layers, Users, Building2, ShieldCheck, ArrowLeft, DoorOpen,
  UserCheck, Calendar, Mail, Phone, Workflow, ClipboardList, Briefcase,
} from "lucide-react";

// inline Badge
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

type RoleRow = { id: string; title: string; level: string | null; mission: string | null; default_assignee: "human" | "ai" };
type MemberRow = { user_id: string; role_id: string; full_name: string | null; role_title: string };

const DATA = {
  section: { name: "قسم المحاسبة", description: "مسؤول عن القيود المحاسبية والتسويات وإعداد القوائم المالية الدورية للمنشأة." },
  department: { id: "dept-1", name: "الإدارة المالية" },
  manager: { full_name: "نورة القحطاني", role_title: "رئيس قسم المحاسبة", joined_at: "2022-06-01" },
  roles: [
    { id: "role-1", title: "محاسب أول", level: "مستوى 3", mission: "القيود المحاسبية والتسويات الشهرية ومطابقة الحسابات.", default_assignee: "human" },
    { id: "role-2", title: "محاسب", level: "مستوى 2", mission: "إدخال البيانات المالية ومتابعة الفواتير.", default_assignee: "human" },
    { id: "role-3", title: "مدقق آلي للفواتير", level: null, mission: "فحص الفواتير ومطابقتها آلياً.", default_assignee: "ai" },
  ] as RoleRow[],
  members: [
    { user_id: "u-1001", role_id: "role-1", full_name: "ريم الشمري", role_title: "محاسب أول" },
    { user_id: "u-1002", role_id: "role-1", full_name: "ماجد الحربي", role_title: "محاسب أول" },
    { user_id: "u-1003", role_id: "role-2", full_name: "سلطان العنزي", role_title: "محاسب" },
    { user_id: "u-1004", role_id: "role-2", full_name: "أمل الغامدي", role_title: "محاسب" },
    { user_id: "u-1005", role_id: "role-2", full_name: "فهد المطيري", role_title: "محاسب" },
  ] as MemberRow[],
  openWorkflows: 9,
  forms: 6,
  policies: 4,
};

export default function SectionPage() {
  const { id } = useParams<{ id: string }>();
  void id;
  const d = DATA;

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="space-y-5">
        {/* Header */}
        <Card className="p-6 bg-gradient-to-l from-[hsl(217_91%_60%/0.08)] to-transparent border-r-4 border-r-[hsl(217_91%_60%)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-xl bg-[hsl(217_91%_60%/0.15)] text-[hsl(217_91%_50%)] grid place-items-center">
                <Layers className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{d.section?.name ?? "—"}</h1>
                {d.section?.description && (
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">{d.section.description}</p>
                )}
                {d.department && (
                  <Link href={`/department/${d.department.id}`} className="inline-flex items-center gap-1 text-xs text-[hsl(217_91%_50%)] hover:underline mt-2">
                    <Building2 className="size-3.5" /> {d.department.name}
                  </Link>
                )}
              </div>
            </div>
            {d.department && (
              <Link href={`/department/${d.department.id}`}>
                <Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="size-4" /> رجوع للإدارة</Button>
              </Link>
            )}
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={<Briefcase className="size-4" />} label="المسميات" value={d.roles.length} />
          <Stat icon={<Users className="size-4" />} label="الموظفون" value={d.members.length} />
          <Stat icon={<Workflow className="size-4" />} label="إجراءات مفتوحة" value={d.openWorkflows} />
          <Stat icon={<ClipboardList className="size-4" />} label="النماذج" value={d.forms} />
          <Stat icon={<ShieldCheck className="size-4" />} label="السياسات" value={d.policies} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Section manager */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><UserCheck className="size-4 text-[hsl(217_91%_50%)]" /> مدير القسم</h3>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            {d.manager ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-14 rounded-full bg-gradient-to-br from-[hsl(217_91%_60%)] to-[hsl(217_91%_45%)] text-white grid place-items-center font-bold text-lg">
                    {(d.manager.full_name ?? "?").slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{d.manager.full_name ?? "غير محدد"}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.manager.role_title}</div>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-3">
                  <div className="flex items-center gap-2"><Mail className="size-3.5" /> <span>—</span></div>
                  <div className="flex items-center gap-2"><Phone className="size-3.5" /> <span>—</span></div>
                  {d.manager.joined_at && (
                    <div className="flex items-center gap-2"><Calendar className="size-3.5" /> <span>انضم: {new Date(d.manager.joined_at).toLocaleDateString("ar-EG")}</span></div>
                  )}
                </div>
                <Link href="/office">
                  <Button size="sm" className="w-full bg-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_45%)] gap-1">
                    <DoorOpen className="size-4" /> مكتب مدير القسم
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">لم يُعيَّن مدير بعد</p>
            )}
          </Card>

          {/* Roles in section */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Briefcase className="size-4 text-[hsl(217_91%_50%)]" /> المسميات الوظيفية</h3>
              <Badge variant="outline">{d.roles.length}</Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {d.roles.length === 0 && <p className="text-sm text-muted-foreground col-span-full">لا توجد مسميات بعد</p>}
              {d.roles.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 hover:border-[hsl(217_91%_60%)] transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{r.title}</div>
                      {r.level && <Badge variant="secondary" className="text-[10px] mt-1">{r.level}</Badge>}
                    </div>
                    {r.default_assignee === "ai" && <Badge variant="outline" className="text-[10px]">AI</Badge>}
                  </div>
                  {r.mission && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{r.mission}</p>}
                  <Link href={`/role/${r.id}`}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_60%/0.1)] w-full justify-center">
                      دخول المكتب <ArrowLeft className="size-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Employees */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Users className="size-4 text-[hsl(217_91%_50%)]" /> موظفو القسم</h3>
            <Badge variant="outline">{d.members.length}</Badge>
          </div>
          {d.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد موظفون معيّنون</p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {d.members.map((m, i) => (
                <div key={`${m.user_id}-${i}`} className="rounded-lg border p-3 flex items-center gap-3 hover:border-[hsl(217_91%_60%)] transition-all">
                  <div className="size-10 rounded-full bg-gradient-to-br from-[hsl(217_91%_60%)] to-[hsl(217_91%_45%)] text-white grid place-items-center font-bold text-sm">
                    {(m.full_name ?? "?").slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{m.full_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{m.role_title}</div>
                  </div>
                  <Link href={`/role/${m.role_id}`}>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-[hsl(217_91%_50%)]">
                      <DoorOpen className="size-3.5" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <span className="text-[hsl(217_91%_50%)]">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}
