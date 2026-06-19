"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Briefcase, Target, ShieldCheck, FileText, Users, Layers, Building2, ListChecks, Workflow, Crown } from "lucide-react";

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

type Kpi = { name?: string; target?: string };
type Assignee = { user_id: string; full_name: string | null };
type Permission = { key: string; label: string };

const DATA = {
  role: {
    title: "محاسب أول",
    level: "مستوى 3",
    mission: "مسؤول عن القيود المحاسبية اليومية وإعداد التسويات الشهرية ومطابقة الحسابات البنكية.",
    default_assignee: "human" as "human" | "ai",
    responsibilities: [
      "تسجيل القيود المحاسبية ومراجعتها يومياً",
      "إعداد التسويات البنكية الشهرية",
      "متابعة الذمم المدينة والدائنة",
      "المساهمة في إعداد القوائم المالية",
    ] as string[],
    kpis: [
      { name: "دقة القيود المحاسبية", target: "99%" },
      { name: "مدة إقفال الشهر", target: "≤ 5 أيام" },
      { name: "نسبة مطابقة الحسابات", target: "100%" },
    ] as Kpi[],
  },
  department: { id: "dept-1", name: "الإدارة المالية" },
  section: { id: "sec-1", name: "قسم المحاسبة" },
  authorityRows: 8,
  raciRows: 12,
  documentCycles: 5,
  permissions: [
    { key: "fin.entry.create", label: "إنشاء قيد محاسبي" },
    { key: "fin.report.view", label: "عرض التقارير المالية" },
    { key: "fin.recon.run", label: "تشغيل المطابقات" },
  ] as Permission[],
  assignees: [
    { user_id: "u-1001", full_name: "ريم الشمري" },
    { user_id: "u-1002", full_name: "ماجد الحربي" },
  ] as Assignee[],
};

export default function RoleOfficePage() {
  const { id } = useParams<{ id: string }>();
  void id;
  const d = DATA;
  const r = d.role;
  const responsibilities = r.responsibilities;
  const kpis = r.kpis;
  const isAi = r.default_assignee === "ai";

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
                <h1 className="text-2xl font-bold">{r.title}</h1>
                {r.level && <Badge variant="secondary">{r.level}</Badge>}
                {isAi && <Badge variant="outline" className="text-[10px]"><Crown className="size-3 ml-1" /> وكيل ذكي</Badge>}
              </div>
              {r.mission && <p className="text-sm text-muted-foreground mt-1">{r.mission}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs">
                {d.department && (
                  <Link href={`/department/${d.department.id}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Building2 className="size-3.5" /> {d.department.name}
                  </Link>
                )}
                {d.section && (
                  <Link href={`/section/${d.section.id}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Layers className="size-3.5" /> {d.section.name}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={<ListChecks className="size-5" />} label="المهام/المسؤوليات" value={responsibilities.length} />
          <Stat icon={<Target className="size-5" />} label="مؤشرات الأداء" value={kpis.length} />
          <Stat icon={<ShieldCheck className="size-5" />} label="مصفوفة الصلاحيات" value={d.authorityRows} />
          <Stat icon={<Users className="size-5" />} label="RACI" value={d.raciRows} />
          <Stat icon={<Workflow className="size-5" />} label="الدورات المستندية" value={d.documentCycles} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><ListChecks className="size-4" />المهام والواجبات</h3>
            {responsibilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم تُحدّد بعد. يمكن توليدها تلقائياً مع القائمة.</p>
            ) : (
              <ul className="space-y-2">
                {responsibilities.map((it, i) => (
                  <li key={i} className="rounded-lg border p-3 text-sm flex gap-2">
                    <span className="text-primary font-bold">{i + 1}.</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="size-4" />مؤشرات الأداء (KPIs)</h3>
            {kpis.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد مؤشرات بعد.</p>
            ) : (
              <ul className="space-y-2">
                {kpis.map((kpi, i) => (
                  <li key={i} className="rounded-lg border p-3 text-sm">
                    <div className="font-medium">{kpi.name ?? "—"}</div>
                    {kpi.target && <div className="text-xs text-muted-foreground">الهدف: {kpi.target}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="size-4" />الصلاحيات والحوكمة</h3>
            <ul className="space-y-2">
              {d.permissions.map((p) => (
                <li key={p.key} className="rounded-lg border p-3 text-sm flex items-center justify-between">
                  <span>{p.label}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{p.key}</Badge>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-muted-foreground">
              مصفوفة صلاحيات مرتبطة: <span className="text-foreground font-medium">{d.authorityRows}</span>
              <span className="mx-2">·</span>
              بنود RACI: <span className="text-foreground font-medium">{d.raciRows}</span>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="size-4" />الدورة المستندية</h3>
            <p className="text-sm text-muted-foreground mb-3">
              عدد الدورات المستندية المرتبطة بإدارة هذا المسمى: <span className="text-foreground font-medium">{d.documentCycles}</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link href="/forms" className="text-xs px-3 py-1.5 rounded border hover:border-primary/40 transition-colors">إدارة النماذج</Link>
              <Link href="/workflows" className="text-xs px-3 py-1.5 rounded border hover:border-primary/40 transition-colors">سير العمل</Link>
              <Link href="/governance" className="text-xs px-3 py-1.5 rounded border hover:border-primary/40 transition-colors">الحوكمة</Link>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="size-4" />شاغلو المسمى</h3>
          {d.assignees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isAi ? "يُنفَّذ بواسطة وكيل ذكي." : "لم يُعيَّن موظف بعد لهذا المسمى."}
            </p>
          ) : (
            <div className="grid md:grid-cols-3 gap-2">
              {d.assignees.map((a) => (
                <div key={a.user_id} className="rounded-lg border p-3 text-sm">
                  {a.full_name ?? a.user_id.slice(0, 8)}
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
      <div className="flex items-center gap-2 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}
