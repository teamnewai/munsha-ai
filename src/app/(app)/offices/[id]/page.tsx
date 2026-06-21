export const dynamic = "force-dynamic";

import Link from "next/link";
import { getOfficeDetail } from "@/app/actions/offices";
import { DASHBOARD_LABEL, type SidebarItem } from "@/lib/officeConfig";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ListChecks, ClipboardList, Folder, FileText, KeyRound, BarChart3,
  Wallet, Users, BadgeCheck, Activity, ShieldCheck, Crown, User, Bot, ArrowLeft, Target,
} from "lucide-react";

const ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, ListChecks, ClipboardList, Folder, FileText, KeyRound, BarChart3,
  Wallet, Users, BadgeCheck, Activity, ShieldCheck,
};

const TYPE_ICON = { manager: Crown, department: LayoutDashboard, employee: User, ai: Bot } as const;
const TYPE_ACCENT = {
  manager: "245 158 11", department: "59 130 246", employee: "16 185 129", ai: "147 51 234",
} as const;

export default async function OfficePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getOfficeDetail(id);

  if (!res.ok || !res.office) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <Card className="mulki-card p-12 text-center">
          <LayoutDashboard className="size-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-semibold mb-2">لم يُعثر على هذا المكتب</h2>
          <p className="text-muted-foreground mb-4">المكتب المطلوب غير موجود أو لا تملك صلاحية الوصول إليه.</p>
          <Link href="/offices"><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="size-4" /> العودة للمكاتب</Button></Link>
        </Card>
      </div>
    );
  }

  const o = res.office;
  const accent = TYPE_ACCENT[o.dashboardType];
  const accentStyle = `rgb(${accent})`;
  const TypeIcon = TYPE_ICON[o.dashboardType];
  const sidebar: SidebarItem[] = o.config?.sidebar ?? [];

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="flex gap-5">
        {/* الشريط الجانبي المخصّص للمكتب */}
        <aside className="hidden lg:block w-56 shrink-0">
          <Card className="mulki-card p-3 sticky top-4">
            <div className="px-2 py-2 mb-2 border-b border-border">
              <div className="text-xs text-muted-foreground">الشريط المخصّص</div>
              <div className="font-semibold text-sm truncate">{o.title}</div>
            </div>
            <nav className="space-y-0.5">
              {sidebar.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                return (
                  <a key={item.key} href={item.href.replace("{id}", id)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Icon className="size-4" /> {item.label}
                  </a>
                );
              })}
            </nav>
          </Card>
        </aside>

        <div className="flex-1 min-w-0 space-y-5">
          {/* الترويسة */}
          <Card className="p-6" style={{ background: `linear-gradient(to left, rgb(${accent} / 0.08), transparent)`, borderRight: `4px solid ${accentStyle}` }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-xl grid place-items-center shrink-0" style={{ background: `rgb(${accent} / 0.15)`, color: accentStyle }}>
                  <TypeIcon className="size-6" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-semibold">{o.title}</h1>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: o.deptColor }} />
                    {o.deptName}{o.section ? ` · ${o.section}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `rgb(${accent} / 0.12)`, color: accentStyle }}>
                  {DASHBOARD_LABEL[o.dashboardType]}
                </span>
                <Link href="/offices"><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="size-4" /> المكاتب</Button></Link>
              </div>
            </div>
          </Card>

          {/* المسؤوليات */}
          <section id="responsibilities">
            <Card className="mulki-card p-6">
              <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><ClipboardList className="size-5 text-primary" /> المسؤوليات والواجبات</h2>
              {o.responsibilities.length ? (
                <ul className="grid sm:grid-cols-2 gap-2">
                  {o.responsibilities.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                      <BadgeCheck className="size-4 text-emerald-500 shrink-0 mt-0.5" /> {d}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">لا توجد مسؤوليات محددة.</p>}
            </Card>
          </section>

          <div className="grid md:grid-cols-2 gap-5">
            {/* الصلاحيات */}
            <section id="permissions">
              <Card className="mulki-card p-6 h-full">
                <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><KeyRound className="size-5 text-primary" /> الصلاحيات</h2>
                {o.permissions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {o.permissions.map((p) => (
                      <span key={p} className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-mono">{p}</span>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">لا توجد صلاحيات ممنوحة.</p>}
              </Card>
            </section>

            {/* مؤشرات الأداء */}
            <section id="reports">
              <Card className="mulki-card p-6 h-full">
                <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><Target className="size-5 text-primary" /> مؤشرات الأداء</h2>
                {o.kpis.length ? (
                  <ul className="space-y-2">
                    {o.kpis.map((k, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><BarChart3 className="size-4 text-amber-500 shrink-0 mt-0.5" /> {k}</li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">لا توجد مؤشرات محددة.</p>}
              </Card>
            </section>
          </div>

          {/* النماذج */}
          <section id="forms">
            <Card className="mulki-card p-6">
              <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><FileText className="size-5 text-primary" /> النماذج المتاحة</h2>
              {o.forms.length ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {o.forms.map((f) => (
                    <Link key={f.id} href="/forms" className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm hover:border-primary/40 transition-colors">
                      <FileText className="size-4 text-muted-foreground" /> {f.title}
                    </Link>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">لا توجد نماذج لهذه الإدارة بعد.</p>}
            </Card>
          </section>

          {/* المهام والمستندات (روابط للوحدات المركزية) */}
          <div className="grid md:grid-cols-2 gap-5">
            <section id="tasks">
              <Card className="mulki-card p-6 h-full flex flex-col">
                <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2"><ListChecks className="size-5 text-primary" /> المهام</h2>
                <p className="text-sm text-muted-foreground mb-4 flex-1">مهام هذا المكتب تُدار من وحدة المهام المركزية.</p>
                <Link href="/tasks"><Button variant="outline" size="sm" className="gap-1"><ListChecks className="size-4" /> فتح المهام</Button></Link>
              </Card>
            </section>
            <section id="documents">
              <Card className="mulki-card p-6 h-full flex flex-col">
                <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2"><Folder className="size-5 text-primary" /> المستندات</h2>
                <p className="text-sm text-muted-foreground mb-4 flex-1">وثائق ومعرفة هذا المكتب متاحة في مركز المعرفة.</p>
                <Link href="/knowledge"><Button variant="outline" size="sm" className="gap-1"><Folder className="size-4" /> فتح المستندات</Button></Link>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
