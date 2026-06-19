"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Sparkles,
  FileText, Workflow as WorkflowIcon, Clock,
} from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(173 58% 39%)", "hsl(197 37% 24%)", "hsl(43 74% 66%)", "hsl(27 87% 67%)", "hsl(var(--destructive))"];

type OverviewData = {
  totals: {
    workflow_running: number; workflow_instances: number; workflow_completed: number;
    overdue_tasks: number; workflow_escalated: number; submissions: number;
    submissions_pending: number; submissions_approved: number; ai_runs_30d: number;
    ai_success_30d: number; ai_avg_latency_ms: number | null;
  };
  activity_30d: { day: string; audits: number; submissions: number; ai_runs: number }[];
  workflow_by_status: { name: string; value: number }[];
  submissions_by_status: { name: string; value: number }[];
  top_workflows: { name: string; count: number }[];
  top_forms: { name: string; count: number }[];
  recent_escalations: { id: string; step_key: string; due_at: string | null }[];
};

const DATA: OverviewData = {
  totals: {
    workflow_running: 18, workflow_instances: 142, workflow_completed: 96,
    overdue_tasks: 4, workflow_escalated: 2, submissions: 73,
    submissions_pending: 11, submissions_approved: 54, ai_runs_30d: 320,
    ai_success_30d: 308, ai_avg_latency_ms: 740,
  },
  activity_30d: [
    { day: "01", audits: 12, submissions: 5, ai_runs: 8 },
    { day: "05", audits: 18, submissions: 9, ai_runs: 14 },
    { day: "10", audits: 9, submissions: 4, ai_runs: 11 },
    { day: "15", audits: 22, submissions: 12, ai_runs: 19 },
    { day: "20", audits: 16, submissions: 7, ai_runs: 13 },
    { day: "25", audits: 25, submissions: 14, ai_runs: 21 },
    { day: "30", audits: 20, submissions: 10, ai_runs: 17 },
  ],
  workflow_by_status: [
    { name: "نشطة", value: 18 },
    { name: "مكتملة", value: 96 },
    { name: "متوقفة", value: 14 },
    { name: "مُصعّدة", value: 2 },
  ],
  submissions_by_status: [
    { name: "مسودة", value: 8 },
    { name: "قيد المراجعة", value: 11 },
    { name: "مقبولة", value: 54 },
    { name: "مرفوضة", value: 0 },
  ],
  top_workflows: [
    { name: "اعتماد أمر شراء", count: 34 },
    { name: "طلب إجازة", count: 28 },
    { name: "صرف مستحقات", count: 21 },
    { name: "مخاطبة داخلية", count: 17 },
  ],
  top_forms: [
    { name: "نموذج طلب إجازة", count: 41 },
    { name: "نموذج صرف مستحقات", count: 26 },
    { name: "نموذج تعهد", count: 15 },
    { name: "نموذج تقرير", count: 9 },
  ],
  recent_escalations: [
    { id: "e1", step_key: "manager_approval", due_at: "2026-06-12T10:00:00Z" },
    { id: "e2", step_key: "finance_review", due_at: "2026-06-10T14:30:00Z" },
  ],
};

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const data = DATA;

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            لوحة التقارير
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            تحليل أداء سير العمل والنماذج وتشغيل الذكاء عبر آخر {days} يوماً.
          </p>
        </div>
        <select
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-40 h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="7">آخر 7 أيام</option>
          <option value="14">آخر 14 يوم</option>
          <option value="30">آخر 30 يوم</option>
          <option value="60">آخر 60 يوم</option>
          <option value="90">آخر 90 يوم</option>
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={WorkflowIcon} label="معاملات نشطة" value={data.totals.workflow_running} sub={`${data.totals.workflow_instances} إجمالي`} />
        <Kpi icon={CheckCircle2} label="معاملات مكتملة" value={data.totals.workflow_completed} tone="success" />
        <Kpi icon={AlertTriangle} label="مهام متأخرة" value={data.totals.overdue_tasks} tone={data.totals.overdue_tasks > 0 ? "danger" : undefined} />
        <Kpi icon={TrendingUp} label="تصعيدات" value={data.totals.workflow_escalated} tone={data.totals.workflow_escalated > 0 ? "warning" : undefined} />
        <Kpi icon={FileText} label="تقديمات" value={data.totals.submissions} sub={`${data.totals.submissions_pending} قيد المراجعة`} />
        <Kpi icon={CheckCircle2} label="تقديمات مقبولة" value={data.totals.submissions_approved} tone="success" />
        <Kpi icon={Sparkles} label="تشغيلات الذكاء" value={data.totals.ai_runs_30d} sub={`${data.totals.ai_success_30d} ناجحة`} />
        <Kpi icon={Clock} label="متوسط زمن AI" value={data.totals.ai_avg_latency_ms !== null ? `${data.totals.ai_avg_latency_ms}ms` : "—"} />
      </div>

      {/* Activity line chart */}
      <Card className="mulki-card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">النشاط اليومي</h3>
        <div className="h-72">
          <LineChart data={data.activity_30d} />
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs">
          <LegendItem color={COLORS[0]} label="تدقيق" />
          <LegendItem color={COLORS[3]} label="تقديمات" />
          <LegendItem color={COLORS[4]} label="AI" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="mulki-card p-6">
          <h3 className="font-display text-lg font-semibold mb-4">المعاملات حسب الحالة</h3>
          <div className="h-64">
            <DonutChart data={data.workflow_by_status} />
          </div>
        </Card>

        <Card className="mulki-card p-6">
          <h3 className="font-display text-lg font-semibold mb-4">التقديمات حسب الحالة</h3>
          <div className="h-64">
            <BarChartView data={data.submissions_by_status} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="mulki-card p-6">
          <h3 className="font-display text-lg font-semibold mb-4">أكثر المعاملات استخداماً</h3>
          {data.top_workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لا توجد بيانات</p>
          ) : (
            <ul className="space-y-2">
              {data.top_workflows.map((w, i) => (
                <li key={i} className="flex items-center justify-between border-b border-border/50 last:border-0 pb-2 last:pb-0">
                  <span className="text-sm">{w.name}</span>
                  <Badge variant="secondary">{w.count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="mulki-card p-6">
          <h3 className="font-display text-lg font-semibold mb-4">أكثر النماذج تقديماً</h3>
          {data.top_forms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لا توجد بيانات</p>
          ) : (
            <ul className="space-y-2">
              {data.top_forms.map((f, i) => (
                <li key={i} className="flex items-center justify-between border-b border-border/50 last:border-0 pb-2 last:pb-0">
                  <span className="text-sm">{f.name}</span>
                  <Badge variant="secondary">{f.count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mulki-card p-6">
        <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          آخر التصعيدات
        </h3>
        {data.recent_escalations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">لا توجد تصعيدات.</p>
        ) : (
          <ul className="space-y-2">
            {data.recent_escalations.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{e.step_key}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    الاستحقاق: {e.due_at ? new Date(e.due_at).toLocaleString("ar-SA") : "—"}
                  </div>
                </div>
                <Badge variant="destructive">مُصعَّد</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, sub, tone,
}: {
  icon: LucideIcon; label: string; value: number | string; sub?: string;
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
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function Badge({ variant = "default", children }: { variant?: "default" | "secondary" | "destructive"; children: React.ReactNode }) {
  const cls =
    variant === "secondary" ? "bg-secondary text-secondary-foreground" :
    variant === "destructive" ? "bg-destructive text-destructive-foreground" :
    "mulki-gold-bg";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function LineChart({ data }: { data: { day: string; audits: number; submissions: number; ai_runs: number }[] }) {
  const w = 600, h = 240, pad = 28;
  const max = Math.max(1, ...data.flatMap((d) => [d.audits, d.submissions, d.ai_runs]));
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = (key: "audits" | "submissions" | "ai_runs") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[key])}`).join(" ");
  const series: { key: "audits" | "submissions" | "ai_runs"; color: string }[] = [
    { key: "audits", color: COLORS[0] },
    { key: "submissions", color: COLORS[3] },
    { key: "ai_runs", color: COLORS[4] },
  ];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={y(max * g)} y2={y(max * g)} stroke="hsl(var(--border))" strokeDasharray="3 3" />
      ))}
      {series.map((s) => (
        <path key={s.key} d={line(s.key)} fill="none" stroke={s.color} strokeWidth={2} />
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{d.day}</text>
      ))}
    </svg>
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
    <div className="flex items-stretch justify-around gap-3 h-full pt-2">
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
