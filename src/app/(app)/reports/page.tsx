export const dynamic = "force-dynamic";

import type { LucideIcon } from "lucide-react";
import { getReportsData } from "@/app/actions/structure";
import { Card } from "@/components/ui/card";
import {
  BarChart3, TrendingUp, Users, Building2, CheckCircle2, ClipboardList, Activity,
} from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(173 58% 39%)", "hsl(197 37% 24%)", "hsl(43 74% 66%)", "hsl(27 87% 67%)"];

export default async function ReportsPage() {
  const { ok, totals, deptPerf, activity } = await getReportsData();

  if (!ok) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <Card className="mulki-card p-12 text-center">
          <BarChart3 className="size-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">قاعدة البيانات غير مهيّأة لعرض التقارير.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            لوحة التقارير
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> بيانات حقيقية من قاعدة البيانات
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Kpi icon={Users} label="الموظفون" value={totals.members} />
        <Kpi icon={Building2} label="الإدارات" value={totals.depts} />
        <Kpi icon={ClipboardList} label="مهام مفتوحة" value={totals.openTasks} tone="warning" />
        <Kpi icon={CheckCircle2} label="مهام منجزة" value={totals.doneTasks} tone="success" />
        <Kpi icon={TrendingUp} label="متوسط الأداء" value={`${totals.avgPerf}%`} tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dept performance bar chart */}
        <Card className="mulki-card p-6">
          <h3 className="font-display text-lg font-semibold mb-4">أداء الإدارات</h3>
          {deptPerf.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لا توجد بيانات</p>
          ) : (
            <div className="space-y-3">
              {deptPerf.map((d) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-semibold tabular-nums">{d.perf}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${d.perf}%`, backgroundColor: d.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Activity bar chart */}
        <Card className="mulki-card p-6">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><Activity className="size-5 text-primary" /> النشاط عبر النظام</h3>
          <BarChartView data={activity.map((a) => ({ name: a.label, value: a.value }))} />
        </Card>
      </div>

      {/* Tasks split */}
      <Card className="mulki-card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">توزيع المهام</h3>
        <DonutChart data={[
          { name: "منجزة", value: totals.doneTasks },
          { name: "مفتوحة", value: totals.openTasks },
        ]} />
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, tone,
}: {
  icon: LucideIcon; label: string; value: number | string;
  tone?: "success" | "warning" | "danger";
}) {
  const toneCls =
    tone === "success" ? "text-emerald-500" :
    tone === "warning" ? "text-amber-500" :
    tone === "danger" ? "text-destructive" :
    "text-primary";
  return (
    <Card className="mulki-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className={`size-4 ${toneCls}`} />
      </div>
      <div className={`mt-2 font-display text-2xl font-semibold ${toneCls}`}>{value}</div>
    </Card>
  );
}

function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  const r = 70, cx = 90, cy = 90, stroke = 28;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center justify-center gap-6 h-full">
      <svg viewBox="0 0 180 180" className="size-44 -rotate-90">
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circ;
          const el = (
            <circle
              key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={COLORS[i % COLORS.length]} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-semibold tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChartView({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-stretch justify-around gap-3 h-56 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">{d.value}</span>
          <div className="w-full flex-1 flex items-end">
            <div
              className="w-full rounded-t-md"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: 2, background: COLORS[0] }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground text-center">{d.name}</span>
        </div>
      ))}
    </div>
  );
}
