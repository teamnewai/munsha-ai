"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { cn } from "@/lib/utils";
import {
  Building2, Users, Layers, ClipboardList, AlertCircle, CheckCircle2,
  TrendingUp, Mail, Phone, Calendar, ArrowLeft, DoorOpen, FileText, ShieldCheck,
  Activity, UserCheck, X,
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

type SectionRow = { id: string; name: string; manager_name: string | null; member_count: number };

const DEPT = {
  department: { id: "dept-1", name: "الإدارة المالية", mission: "إدارة الموارد المالية للمنشأة، وضمان الامتثال للأنظمة المحاسبية، وإعداد التقارير المالية الدورية." },
  manager: { full_name: "خالد العتيبي", role_title: "مدير الإدارة المالية", joined_at: "2021-03-15" },
  kpis: { overdueTasks: 4, completedTransactions: 1284, completedTasks: 96, completionRate: 92 },
  sections: [
    { id: "sec-1", name: "قسم المحاسبة", manager_name: "نورة القحطاني", member_count: 6 },
    { id: "sec-2", name: "قسم الميزانية", manager_name: "سعد الدوسري", member_count: 4 },
    { id: "sec-3", name: "قسم المراجعة الداخلية", manager_name: null, member_count: 3 },
    { id: "sec-4", name: "قسم المشتريات", manager_name: "هند الزهراني", member_count: 5 },
  ] as SectionRow[],
  members: new Array(18).fill(null),
  policies: 12,
  openServiceRequests: 7,
};

export default function DepartmentDashboardPage() {
  const { id } = useParams<{ id: string }>();
  void id;
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<"profile" | "job" | "tasks" | "perms">("job");
  const d = DEPT;
  const k = d.kpis;

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="space-y-5">
        {/* Header */}
        <Card className="p-6 bg-gradient-to-l from-[hsl(217_91%_60%/0.08)] to-transparent border-r-4 border-r-[hsl(217_91%_60%)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-xl bg-[hsl(217_91%_60%/0.15)] text-[hsl(217_91%_50%)] grid place-items-center shrink-0">
                <Building2 className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{d.department?.name ?? "—"}</h1>
                {d.department?.mission && (
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">{d.department.mission}</p>
                )}
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
          <KpiCard icon={<AlertCircle />} label="المهام المتأخرة" value={k.overdueTasks} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950/30" />
          <KpiCard icon={<CheckCircle2 />} label="المعاملات المنجزة" value={k.completedTransactions.toLocaleString("ar-EG")} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/30" />
          <KpiCard icon={<ClipboardList />} label="المهام المنجزة" value={k.completedTasks} color="text-[hsl(217_91%_50%)]" bg="bg-[hsl(217_91%_60%/0.1)]" />
          <KpiCard icon={<TrendingUp />} label="نسبة الإنجاز" value={`${k.completionRate}%`} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/30" />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Manager card */}
          <Card className="p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><UserCheck className="size-4 text-[hsl(217_91%_50%)]" /> مدير الإدارة</h3>
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
                  <div className="flex items-center gap-2"><Mail className="size-3.5" /> <span className="truncate">—</span></div>
                  <div className="flex items-center gap-2"><Phone className="size-3.5" /> <span>—</span></div>
                  {d.manager.joined_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5" />
                      <span>انضم: {new Date(d.manager.joined_at).toLocaleDateString("ar-EG")}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setPanelOpen(true)}>
                    الملف الوظيفي
                  </Button>
                  <Link href="/office" className="flex-1">
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

          {/* Sections grid */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Layers className="size-4 text-[hsl(217_91%_50%)]" /> الأقسام التابعة</h3>
              <Badge variant="outline">{d.sections.length}</Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {d.sections.length === 0 && <p className="text-sm text-muted-foreground col-span-full">لا توجد أقسام بعد</p>}
              {d.sections.map((s) => (
                <div key={s.id} className="rounded-lg border p-3 hover:border-[hsl(217_91%_60%)] hover:shadow-sm transition-all bg-card">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="size-8 rounded-lg bg-[hsl(217_91%_60%/0.1)] text-[hsl(217_91%_50%)] grid place-items-center shrink-0">
                      <Layers className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {s.manager_name ? `المدير: ${s.manager_name}` : "بدون مدير"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="secondary" className="text-[10px]"><Users className="size-3 ml-1" /> {s.member_count}</Badge>
                    <Link href={`/section/${s.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_60%/0.1)]">
                        دخول <ArrowLeft className="size-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5">
            <h4 className="font-semibold mb-3 flex items-center gap-2"><Activity className="size-4 text-[hsl(217_91%_50%)]" /> الوصول السريع</h4>
            <div className="space-y-2">
              <Link href="/office"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><DoorOpen className="size-4" /> دخول المكتب</Button></Link>
              <Link href="/people"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><Users className="size-4" /> فريق الإدارة ({d.members.length})</Button></Link>
              <Link href="/reports"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><FileText className="size-4" /> التقارير</Button></Link>
            </div>
          </Card>

          <Card className="p-5">
            <h4 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="size-4 text-[hsl(217_91%_50%)]" /> الحوكمة</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">السياسات</span><span className="font-medium">{d.policies}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">طلبات مفتوحة</span><span className="font-medium">{d.openServiceRequests}</span></div>
              <Link href="/governance"><Button size="sm" variant="outline" className="w-full mt-2">مركز الحوكمة</Button></Link>
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-[hsl(217_91%_60%/0.1)] to-emerald-500/5">
            <h4 className="font-semibold mb-2 flex items-center gap-2"><DoorOpen className="size-4 text-emerald-600" /> الدخول إلى مكاتب الموظفين</h4>
            <p className="text-xs text-muted-foreground mb-3">اطلع على ما يعمل عليه موظفو الإدارة الآن.</p>
            <Link href="/people">
              <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 gap-1">
                <Users className="size-4" /> عرض الموظفين
              </Button>
            </Link>
          </Card>
        </div>

        {/* Slide panel for manager */}
        {panelOpen && (
          <div className="fixed inset-0 z-50" dir="rtl">
            <div className="absolute inset-0 bg-black/50" onClick={() => setPanelOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-full sm:max-w-md bg-background border-r border-border shadow-lg p-6 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">الملف الوظيفي — {d.manager?.full_name ?? "—"}</h2>
                <button type="button" onClick={() => setPanelOpen(false)} className="rounded-md p-1 hover:bg-accent/50">
                  <X className="size-4" />
                </button>
              </div>
              {d.manager && (
                <div className="mt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-16 rounded-full bg-gradient-to-br from-[hsl(217_91%_60%)] to-[hsl(217_91%_45%)] text-white grid place-items-center font-bold text-2xl">
                      {(d.manager.full_name ?? "?").slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-bold">{d.manager.full_name}</div>
                      <div className="text-xs text-muted-foreground">{d.manager.role_title}</div>
                      <Badge variant="outline" className="mt-1 text-[10px] gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-500" /> متصل الآن
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full">
                    <div className="w-full grid grid-cols-4 rounded-lg bg-muted p-1 gap-1">
                      {([
                        ["profile", "الملف"],
                        ["job", "الوصف"],
                        ["tasks", "المهام"],
                        ["perms", "الصلاحيات"],
                      ] as const).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTab(val)}
                          className={cn(
                            "rounded-md py-1.5 text-xs font-medium transition-colors",
                            tab === val ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                    {tab === "profile" && (
                      <div className="text-sm space-y-2 mt-3">
                        <div className="flex justify-between"><span className="text-muted-foreground">المسمى:</span><span>{d.manager.role_title}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">الإدارة:</span><span>{d.department?.name}</span></div>
                        {d.manager.joined_at && <div className="flex justify-between"><span className="text-muted-foreground">تاريخ الانضمام:</span><span>{new Date(d.manager.joined_at).toLocaleDateString("ar-EG")}</span></div>}
                      </div>
                    )}
                    {tab === "job" && (
                      <div className="text-sm mt-3">
                        <p className="text-muted-foreground leading-relaxed">{d.department?.mission ?? "لا يوجد وصف وظيفي."}</p>
                      </div>
                    )}
                    {tab === "tasks" && (
                      <div className="text-sm mt-3 space-y-2">
                        <div className="rounded-lg border p-3"><CheckCircle2 className="size-3.5 inline text-[hsl(217_91%_50%)] ml-1" /> الإشراف على الأقسام</div>
                        <div className="rounded-lg border p-3"><CheckCircle2 className="size-3.5 inline text-[hsl(217_91%_50%)] ml-1" /> رفع التقارير الدورية</div>
                        <div className="rounded-lg border p-3"><CheckCircle2 className="size-3.5 inline text-[hsl(217_91%_50%)] ml-1" /> اعتماد المعاملات والميزانية</div>
                      </div>
                    )}
                    {tab === "perms" && (
                      <div className="text-sm mt-3 space-y-2">
                        <div className="rounded-lg border p-3 flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /> اعتماد الطلبات</div>
                        <div className="rounded-lg border p-3 flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /> توزيع المهام</div>
                        <div className="rounded-lg border p-3 flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /> اعتماد التقارير</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
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
