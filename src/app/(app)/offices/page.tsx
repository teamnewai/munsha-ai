"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getOffices, type OfficeSummary } from "@/app/actions/offices";
import { DASHBOARD_LABEL } from "@/lib/officeConfig";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Search, Crown, User, Bot, Building2, Loader2, ArrowLeft, Sparkles } from "lucide-react";

const TYPE_ICON = { manager: Crown, department: Building2, employee: User, ai: Bot } as const;
const TYPE_COLOR = {
  manager: "text-amber-500 bg-amber-500/10",
  department: "text-blue-500 bg-blue-500/10",
  employee: "text-emerald-500 bg-emerald-500/10",
  ai: "text-purple-500 bg-purple-500/10",
} as const;

export default function OfficesPage() {
  const [offices, setOffices] = useState<OfficeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "manager" | "employee" | "ai">("all");

  useEffect(() => {
    let alive = true;
    getOffices().then((r) => { if (alive) { setOffices(r.offices); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const visible = useMemo(() => {
    let base = offices;
    if (filter !== "all") base = base.filter((o) => o.dashboardType === filter);
    if (q.trim()) base = base.filter((o) => o.title.includes(q) || o.deptName.includes(q) || (o.section ?? "").includes(q));
    return base;
  }, [offices, q, filter]);

  const counts = useMemo(() => ({
    all: offices.length,
    manager: offices.filter((o) => o.dashboardType === "manager").length,
    employee: offices.filter((o) => o.dashboardType === "employee").length,
    ai: offices.filter((o) => o.dashboardType === "ai").length,
  }), [offices]);

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <LayoutDashboard className="size-6 text-primary" /> المكاتب واللوحات
          </h2>
          <p className="text-sm text-muted-foreground mt-1">لكل مسمى وظيفي مكتب افتراضي ولوحة تحكم خاصة — مُولّدة من بناء المنشأة.</p>
        </div>
      </div>

      {!loading && offices.length === 0 ? (
        <Card className="mulki-card p-12 text-center">
          <Sparkles className="size-10 text-primary/60 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">لم تُنشأ مكاتب بعد. ابنِ منشأتك ليُولَّد لكل وظيفة مكتب افتراضي ولوحة تحكم.</p>
          <Link href="/org-builder" className="inline-flex items-center gap-2 rounded-xl mulki-gold-bg px-5 py-2.5 text-sm font-bold hover:opacity-90">
            <Sparkles className="size-4" /> بناء المنشأة
          </Link>
        </Card>
      ) : (
        <>
          {/* فلاتر */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { key: "all", label: "جميع المكاتب", value: counts.all },
              { key: "manager", label: "لوحات المدراء", value: counts.manager },
              { key: "employee", label: "لوحات الموظفين", value: counts.employee },
              { key: "ai", label: "لوحات وكلاء AI", value: counts.ai },
            ] as const).map((s) => (
              <button key={s.key} onClick={() => setFilter(s.key)}
                className={cn("rounded-xl border p-4 text-center transition-colors", filter === s.key ? "border-primary/50 bg-primary/5" : "border-border bg-background/40 hover:border-primary/30")}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>

          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ابحث باسم الوظيفة أو الإدارة..." value={q} onChange={(e) => setQ(e.target.value)} className="pe-9" />
          </div>

          {loading ? (
            <Card className="mulki-card p-12 text-center"><Loader2 className="size-8 text-primary mx-auto animate-spin" /></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((o) => {
                const Icon = TYPE_ICON[o.dashboardType];
                return (
                  <Link key={`${o.kind}-${o.id}`} href={`/offices/${o.id}`}>
                    <Card className="mulki-card p-5 h-full hover:border-primary/40 transition-colors group">
                      <div className="flex items-start gap-3">
                        <span className={cn("size-11 rounded-xl grid place-items-center shrink-0", TYPE_COLOR[o.dashboardType])}>
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display font-semibold truncate">{o.title}</h3>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                            <span className="size-2 rounded-full" style={{ backgroundColor: o.deptColor }} />
                            {o.deptName}{o.section ? ` · ${o.section}` : ""}
                          </p>
                        </div>
                        <ArrowLeft className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", TYPE_COLOR[o.dashboardType])}>
                          {DASHBOARD_LABEL[o.dashboardType]}
                        </span>
                        {o.status === "vacant" && <span className="text-[10px] text-muted-foreground">وظيفة شاغرة</span>}
                        {o.kind === "ai" && o.status === "active" && <span className="text-[10px] text-emerald-500">نشط</span>}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
