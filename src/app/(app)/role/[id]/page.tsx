export const dynamic = "force-dynamic";

import Link from "next/link";
import { getRoleById } from "@/app/actions/structure";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Briefcase, Target, ShieldCheck, FileText, Users, Building2, ListChecks, Workflow, ArrowLeft, GraduationCap, ArrowUpRight } from "lucide-react";

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

const PERM_LABEL: Record<string, string> = {
  view: "الاطّلاع", create: "الإضافة", edit: "التعديل", delete: "الحذف",
  approve: "الاعتماد", reports: "التقارير", manage_members: "إدارة الموظفين", finance: "العمليات المالية",
};

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}

export default async function RoleOfficePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ok, role, holders } = await getRoleById(id);

  if (!ok || !role) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <Card className="mulki-card p-12 text-center">
          <Briefcase className="size-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-semibold mb-2">لم يُعثر على هذا المسمى الوظيفي</h2>
          <Link href="/org" className="text-primary text-sm hover:underline inline-flex items-center gap-1 mt-2"><ArrowLeft className="size-4" /> العودة إلى الهيكل</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" dir="rtl">
      <div className="space-y-6">
        {/* Identity card */}
        <Card className="p-6 bg-gradient-to-l from-primary/5 to-transparent">
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Briefcase className="size-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-display">{role.title}</h1>
                {role.reports_to && <Badge variant="secondary">يرفع إلى: {role.reports_to}</Badge>}
              </div>
              {role.purpose && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{role.purpose}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs">
                <Link href={`/department/${role.dept_key}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Building2 className="size-3.5" /> {role.deptName}
                </Link>
                {role.section_name && (
                  <span className="flex items-center gap-1 text-muted-foreground"><Workflow className="size-3.5" /> {role.section_name}</span>
                )}
              </div>
              <div className="inline-flex items-center gap-1.5 mt-3 rounded-full border px-2.5 py-0.5 text-[11px]">
                <span className="size-1.5 rounded-full bg-emerald-500" /> بيانات حقيقية من قاعدة البيانات
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<ListChecks className="size-5" />} label="المهام/المسؤوليات" value={role.duties.length} />
          <Stat icon={<Target className="size-5" />} label="مؤشرات الأداء" value={role.kpis.length} />
          <Stat icon={<ShieldCheck className="size-5" />} label="الصلاحيات" value={role.perms.length} />
          <Stat icon={<Users className="size-5" />} label="شاغلو المسمى" value={holders.length} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><ListChecks className="size-4 text-primary" />المهام والواجبات</h3>
            {role.duties.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم تُحدّد بعد.</p>
            ) : (
              <ul className="space-y-2">
                {role.duties.map((it, i) => (
                  <li key={i} className="rounded-lg border p-3 text-sm flex gap-2">
                    <span className="text-primary font-bold">{i + 1}.</span><span>{it}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="size-4 text-primary" />مؤشرات الأداء (KPIs)</h3>
            {role.kpis.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد مؤشرات بعد.</p>
            ) : (
              <ul className="space-y-2">
                {role.kpis.map((kpi, i) => (
                  <li key={i} className="rounded-lg border p-3 text-sm flex items-center gap-2">
                    <ArrowUpRight className="size-4 text-emerald-500 shrink-0" /> {kpi}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />الصلاحيات والحوكمة</h3>
            {role.perms.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد صلاحيات محددة.</p>
            ) : (
              <ul className="space-y-2">
                {role.perms.map((p) => (
                  <li key={p} className="rounded-lg border p-3 text-sm flex items-center justify-between">
                    <span>{PERM_LABEL[p] ?? p}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{p}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2 flex-wrap">
              <Link href="/permissions" className="text-xs px-3 py-1.5 rounded border hover:border-primary/40 transition-colors">إدارة الصلاحيات</Link>
              <Link href="/governance" className="text-xs px-3 py-1.5 rounded border hover:border-primary/40 transition-colors">الحوكمة</Link>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><GraduationCap className="size-4 text-primary" />المؤهلات والدورة المستندية</h3>
            {role.qualifications && <p className="text-sm text-muted-foreground mb-3">{role.qualifications}</p>}
            <div className="flex gap-2 flex-wrap">
              <Link href="/forms" className="text-xs px-3 py-1.5 rounded border hover:border-primary/40 transition-colors"><FileText className="size-3 inline ml-1" />النماذج</Link>
              <Link href="/workflows" className="text-xs px-3 py-1.5 rounded border hover:border-primary/40 transition-colors"><Workflow className="size-3 inline ml-1" />سير العمل</Link>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="size-4 text-primary" />شاغلو المسمى ({holders.length})</h3>
          {holders.length === 0 ? (
            <p className="text-sm text-muted-foreground">لم يُعيَّن موظف بعد لهذا المسمى.</p>
          ) : (
            <div className="grid md:grid-cols-3 gap-2">
              {holders.map((a) => (
                <Link key={a.id} href={`/workspace/${a.id}`} className="rounded-lg border p-3 text-sm flex items-center gap-2 hover:border-primary/40 transition-colors">
                  <span className={cn("size-2 rounded-full shrink-0", a.present ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                  <span className="flex-1">{a.name}</span>
                  <ArrowLeft className="size-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
