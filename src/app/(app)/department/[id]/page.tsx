export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDeptByKey } from "@/app/actions/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { cn } from "@/lib/utils";
import {
  Building2, Users, Layers, ClipboardList, AlertCircle, CheckCircle2,
  TrendingUp, ArrowLeft, DoorOpen, FileText, ShieldCheck,
  Activity, UserCheck,
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

function KpiCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number | string; color: string; bg: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`size-8 rounded-lg ${bg} ${color} grid place-items-center`}>
          <span className="[&_svg]:size-4">{icon}</span>
        </div>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}

export default async function DepartmentDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getDeptByKey(id);

  if (!result.ok || !result.dept) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <Card className="mulki-card p-12 text-center">
          <Building2 className="size-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-semibold mb-2">لم يُعثر على هذا القسم</h2>
          <p className="text-muted-foreground mb-4">القسم المطلوب غير موجود أو لا تملك صلاحية الوصول إليه.</p>
          <Link href="/org">
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="size-4" /> العودة إلى الهيكل التنظيمي
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const dept = result.dept;
  const headMember = dept.members.find((m) => m.roleInDept === "head");

  // Use dept color for accent, fallback to primary blue
  const accentHsl = dept.color ?? "217 91% 60%";
  const accentStyle = `hsl(${accentHsl})`;

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="space-y-5">
        {/* Header */}
        <Card
          className="p-6"
          style={{
            background: `linear-gradient(to left, hsl(${accentHsl} / 0.08), transparent)`,
            borderRight: `4px solid ${accentStyle}`,
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div
                className="size-12 rounded-xl grid place-items-center shrink-0"
                style={{ background: `hsl(${accentHsl} / 0.15)`, color: accentStyle }}
              >
                <Building2 className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display">{dept.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {dept.staffCount} موظف · {dept.openTasks} مهمة مفتوحة · نسبة الإنجاز {dept.perf}%
                </p>
              </div>
            </div>
            <Link href="/org">
              <Button variant="outline" size="sm" className="gap-1">
                <ArrowLeft className="size-4" /> رجوع
              </Button>
            </Link>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={<Users />}
            label="عدد الموظفين"
            value={dept.staffCount}
            color="text-[hsl(217_91%_50%)]"
            bg="bg-[hsl(217_91%_60%/0.1)]"
          />
          <KpiCard
            icon={<AlertCircle />}
            label="المهام المفتوحة"
            value={dept.openTasks}
            color="text-amber-600"
            bg="bg-amber-50 dark:bg-amber-950/30"
          />
          <KpiCard
            icon={<CheckCircle2 />}
            label="المهام المنجزة"
            value={dept.doneTasks}
            color="text-emerald-600"
            bg="bg-emerald-50 dark:bg-emerald-950/30"
          />
          <KpiCard
            icon={<TrendingUp />}
            label="نسبة الإنجاز"
            value={`${dept.perf}%`}
            color="text-emerald-600"
            bg="bg-emerald-50 dark:bg-emerald-950/30"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Manager card */}
          <Card className="p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <UserCheck className="size-4 text-[hsl(217_91%_50%)]" /> مدير الإدارة
              </h3>
              {headMember && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
            </div>
            {headMember ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-14 rounded-full bg-gradient-to-br from-[hsl(217_91%_60%)] to-[hsl(217_91%_45%)] text-white grid place-items-center font-bold text-lg">
                    {headMember.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{headMember.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{headMember.title}</div>
                    <Badge variant="outline" className="mt-1 text-[10px]">المدير</Badge>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Link href={`/workspace/${headMember.id}`} className="flex-1">
                    <Button size="sm" className="w-full bg-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_45%)] gap-1">
                      <DoorOpen className="size-4" /> مكتب المدير
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">لم يُعيَّن مدير بعد</p>
            )}
          </Card>

          {/* Sections — no real data mapping yet */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Layers className="size-4 text-[hsl(217_91%_50%)]" /> الأقسام التابعة
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">لا توجد أقسام مسجّلة بعد</p>
          </Card>
        </div>

        {/* Members list */}
        {dept.members.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="size-4 text-[hsl(217_91%_50%)]" /> أعضاء القسم
              </h3>
              <Badge variant="outline">{dept.members.length}</Badge>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {dept.members.map((member) => (
                <Link key={member.id} href={`/workspace/${member.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:border-[hsl(217_91%_60%)] hover:shadow-sm transition-all bg-card cursor-pointer">
                    <div className="size-9 rounded-full bg-gradient-to-br from-[hsl(217_91%_60%)] to-[hsl(217_91%_45%)] text-white grid place-items-center font-semibold text-sm shrink-0">
                      {member.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{member.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{member.title}</div>
                    </div>
                    {member.roleInDept === "head" && (
                      <Badge variant="default" className="text-[10px] shrink-0">المدير</Badge>
                    )}
                    {member.present && (
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0" title="متصل" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Bottom row */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="size-4 text-[hsl(217_91%_50%)]" /> الوصول السريع
            </h4>
            <div className="space-y-2">
              {headMember && (
                <Link href={`/workspace/${headMember.id}`}>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <DoorOpen className="size-4" /> دخول مكتب المدير
                  </Button>
                </Link>
              )}
              <Link href="/people">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Users className="size-4" /> فريق الإدارة ({dept.staffCount})
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <FileText className="size-4" /> التقارير
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-[hsl(217_91%_50%)]" /> الحوكمة
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المهام المفتوحة</span>
                <span className="font-medium">{dept.openTasks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المهام المنجزة</span>
                <span className="font-medium">{dept.doneTasks}</span>
              </div>
              <Link href="/governance">
                <Button size="sm" variant="outline" className="w-full mt-2">مركز الحوكمة</Button>
              </Link>
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-[hsl(217_91%_60%/0.1)] to-emerald-500/5">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <ClipboardList className="size-4 text-emerald-600" /> أداء القسم
            </h4>
            <p className="text-xs text-muted-foreground mb-3">نسبة إنجاز المهام الحالية للقسم.</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">نسبة الإنجاز</span>
                <span className="font-bold text-emerald-600">{dept.perf}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(dept.perf, 100)}%` }}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
