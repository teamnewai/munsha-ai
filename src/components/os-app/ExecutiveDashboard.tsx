"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { toast } from "@/lib/toast";
import { COMPANY, fmt, type OsData } from "@/lib/os-data";
import {
  TrendingUp, TrendingDown, DollarSign, CheckCircle2, Users, AlertTriangle,
  Building2, Wallet, UserCheck, Megaphone, Settings as SettingsIcon, Briefcase,
  Monitor, FileText, BarChart3, PieChart, Phone, Video, ScreenShare, Radio,
  Send, Share2, Plus, ChevronDown, MessageSquare, type LucideIcon,
} from "lucide-react";

const DEPT_ICON: Record<string, LucideIcon> = {
  finance: Wallet, hr: Users, sales: BarChart3, ops: SettingsIcon,
  marketing: Megaphone, legal: Briefcase, realestate: Building2, it: Monitor,
  management: Building2, maintenance: SettingsIcon,
};
const iconFor = (key: string): LucideIcon => DEPT_ICON[key] ?? Building2;

function Sparkline({ color, down = false }: { color: string; down?: boolean }) {
  const up = "M0 30 L15 22 L30 26 L45 14 L60 18 L75 8 L90 12 L105 4";
  const dn = "M0 8 L15 16 L30 12 L45 22 L60 18 L75 26 L90 20 L105 28";
  return (
    <svg viewBox="0 0 105 36" className="w-full h-10">
      <defs>
        <linearGradient id={`g-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${down ? dn : up} L105 36 L0 36 Z`} fill={`url(#g-${color})`} />
      <path d={down ? dn : up} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Donut({ value, color }: { value: number; color: string }) {
  const r = 22; const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg viewBox="0 0 60 60" className="size-14">
      <circle cx="30" cy="30" r={r} stroke="var(--color-border)" strokeWidth="6" fill="none" />
      <circle cx="30" cy="30" r={r} stroke={color} strokeWidth="6" fill="none"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 30 30)" />
      <text x="30" y="34" textAnchor="middle" className="fill-foreground" fontSize="13" fontWeight="600">{value}%</text>
    </svg>
  );
}

const COMMS = {
  اجتماعات: [
    { from: "الرئيس التنفيذي", to: "جميع الموظفين", msg: "اجتماع يوم الأحد القادم", time: "09:00 AM", badge: 5 },
    { from: "المالية", to: "المبيعات", msg: "مراجعة الميزانية الربعية", time: "11:30 AM", badge: 2 },
  ],
  مكالمات: [
    { from: "الموارد البشرية", to: "التشغيل", msg: "مكالمة بخصوص طلب الإجازة", time: "10:15 AM", badge: 1 },
    { from: "المبيعات", to: "العميل 1001", msg: "متابعة عرض السعر", time: "09:40 AM", badge: 3 },
  ],
  رسائل: [
    { from: "المالية", to: "المبيعات", msg: "تم تحويل المبلغ للعميل رقم 1001", time: "10:30 AM", badge: 3 },
    { from: "الموارد البشرية", to: "التشغيل", msg: "طلب إجازة جديد من الموظف أحمد", time: "10:15 AM", badge: 2 },
  ],
} as const;
type CommsTab = keyof typeof COMMS;

export function ExecutiveDashboard({ data }: { data: OsData }) {
  const router = useRouter();
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const [commsTab, setCommsTab] = useState<CommsTab>("اجتماعات");
  const { departments: DEPARTMENTS, employees: EMPLOYEES, tasks: TASKS, finance: FINANCE } = data;
  const owner = data.owner || COMPANY.owner;

  const heroStats = [
    { label: "إجمالي الإيرادات", value: fmt(FINANCE.revenue), change: "+15.6%", color: "#10b981", icon: TrendingUp, kind: "spark" as const },
    { label: "إجمالي المصروفات", value: fmt(FINANCE.expenses), change: "+8.3%", color: "#ef4444", icon: TrendingDown, kind: "spark" as const, down: true },
    { label: "إجمالي الأرباح", value: fmt(FINANCE.profit), change: "+21.4%", color: "#10b981", icon: DollarSign, kind: "spark" as const },
    { label: "المهام المكتملة", value: `${TASKS.completedPct}%`, change: "+10%", color: "#3b82f6", icon: CheckCircle2, kind: "donut" as const, donut: TASKS.completedPct },
    { label: "الموظفون المتواجدون", value: `${EMPLOYEES.present} / ${EMPLOYEES.total}`, change: "متواجد الآن", color: "#8b5cf6", icon: Users, kind: "spark" as const },
    { label: "المهام المتأخرة", value: String(TASKS.overdue), change: "تحتاج متابعة", color: "#f59e0b", icon: AlertTriangle, kind: "alert" as const },
  ];

  const presentNow = data.presentNow;
  const absent = data.absent;
  const reports = [
    { title: "التقرير المالي الشهري", date: "مايو 2024", icon: FileText, color: "#ef4444" },
    { title: "تقرير المبيعات التفصيلي", date: "مايو 2024", icon: BarChart3, color: "#3b82f6" },
    { title: "تقرير أداء الموظفين", date: "مايو 2024", icon: PieChart, color: "#a855f7" },
    { title: "تقرير المشاريع", date: "مايو 2024", icon: TrendingUp, color: "#10b981" },
  ];
  const actionBar = [
    { label: "مكالمة صوتية", icon: Phone, color: "#10b981", action: () => router.push("/people") },
    { label: "مكالمة فيديو", icon: Video, color: "#3b82f6", action: () => router.push("/people") },
    { label: "شاشة ومتابعة", icon: ScreenShare, color: "#8b5cf6", action: () => router.push("/meetings") },
    { label: "بث مباشر", icon: Radio, color: "#ec4899", action: () => router.push("/meetings") },
    { label: "إرسال رسالة", icon: Send, color: "#f59e0b", action: () => router.push("/network") },
    { label: "مشاركة ملف", icon: Share2, color: "#06b6d4", action: () => router.push("/knowledge") },
  ];

  return (
    <section className="space-y-6">
      {/* Hero */}
      <Card className="mulki-card p-6 relative overflow-hidden">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div className="text-right">
            <h2 className="font-display text-2xl md:text-3xl font-semibold">مرحباً بك، {owner}</h2>
            <p className="text-sm text-muted-foreground mt-1">نظرة عامة على أداء «{data.orgName}» اليوم</p>
            <span className={`inline-flex items-center gap-1.5 mt-2 rounded-full px-2.5 py-0.5 text-[11px] ${
              data.source === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              <span className={`size-1.5 rounded-full ${data.source === "live" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
              {data.source === "live" ? "متصل بقاعدة البيانات" : "عرض تجريبي"}
            </span>
          </div>
          <div className="relative">
            <select value={range} onChange={(e) => setRange(e.target.value as typeof range)}
              className="appearance-none rounded-lg border border-border bg-background/40 px-3 py-2 pe-8 text-sm cursor-pointer focus:outline-none focus:border-primary">
              <option value="day">اليوم</option>
              <option value="week">هذا الأسبوع</option>
              <option value="month">هذا الشهر</option>
            </select>
            <ChevronDown className="size-4 absolute top-1/2 -translate-y-1/2 start-2 pointer-events-none text-muted-foreground" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {heroStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-background/30 p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="font-display text-xl md:text-2xl font-semibold mt-2" style={s.kind === "alert" ? { color: s.color } : undefined}>
                {s.value}
              </div>
              <div className="text-[11px] mt-1" style={{ color: s.color }}>{s.change}</div>
              <div className="mt-2">
                {s.kind === "donut" ? (
                  <div className="flex justify-center"><Donut value={s.donut!} color={s.color} /></div>
                ) : s.kind === "alert" ? (
                  <div className="flex justify-center pt-1"><AlertTriangle className="size-8" style={{ color: s.color }} /></div>
                ) : (
                  <Sparkline color={s.color} down={s.down} />
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Present + Org */}
      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-4">
        <Card className="mulki-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">الموظفون المتواجدون الآن</h3>
            <UserCheck className="size-4 text-primary" />
          </div>
          <ul className="space-y-3">
            {presentNow.map((p) => (
              <li key={p.name} className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">{p.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.role}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">{p.dept}</div>
                  <div className="text-[11px] text-emerald-500 flex items-center gap-1 justify-end">
                    <span className="size-1.5 rounded-full bg-emerald-500" />متواجد {p.time}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-border/50 mt-4 pt-3">
            <div className="text-xs text-muted-foreground mb-2">الموظفون غير المتواجدين ({EMPLOYEES.absent})</div>
            <ul className="space-y-2">
              {absent.map((p) => (
                <li key={p.name} className="flex items-center gap-3 opacity-70">
                  <div className="size-7 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">{p.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.role}</div>
                  </div>
                  <div className="text-[11px] text-red-500">غير متواجد</div>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="mulki-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">القائمة</h3>
            <Link href="/org" className="text-xs text-primary">عرض الكل</Link>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-center">
              <div className="text-sm font-semibold">{owner}</div>
              <div className="text-[11px] text-muted-foreground">{COMPANY.title}</div>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 w-full">
              {DEPARTMENTS.map((r) => {
                const Icon = iconFor(r.key);
                return (
                  <Link key={r.key} href="/org" className="flex flex-col items-center gap-1.5 group">
                    <div className="size-10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: `${r.color}20`, color: r.color }}>
                      <Icon className="size-5" />
                    </div>
                    <div className="text-[10px] text-center text-muted-foreground leading-tight">{r.name}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Departments */}
      <div>
        <h3 className="font-display text-sm uppercase tracking-[0.22em] text-muted-foreground mb-3">الإدارات</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {DEPARTMENTS.map((d) => {
            const Icon = iconFor(d.key);
            return (
              <Card key={d.key} className="mulki-card p-4 relative overflow-hidden">
                <div className="absolute -top-8 -end-8 size-24 rounded-full blur-2xl opacity-30" style={{ backgroundColor: d.color }} />
                <div className="relative flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-display font-semibold" style={{ color: d.color }}>{d.name}</div>
                    <div className="text-[11px] text-muted-foreground">{d.employees} موظف</div>
                  </div>
                  <div className="size-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${d.color}20`, color: d.color }}>
                    <Icon className="size-4" />
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">المهام المفتوحة</span><span className="font-semibold">{d.open}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">المهام المكتملة</span><span className="font-semibold">{d.done}</span></div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground">الأداء</span>
                    <Donut value={d.perf} color={d.color} />
                  </div>
                </div>
                <Link href="/org" className="mt-3 block text-center rounded-lg border border-border/60 py-1.5 text-xs hover:border-primary/50 transition-colors">دخول الإدارة</Link>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Reports + Communications */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="mulki-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">التقارير الذكية</h3>
            <Link href="/reports" className="text-xs text-primary">عرض الكل</Link>
          </div>
          <ul className="space-y-2">
            {reports.map((r) => {
              const Icon = r.icon;
              return (
                <Link key={r.title} href="/reports" className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/40 transition-colors">
                  <div className="size-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${r.color}20`, color: r.color }}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.date}</div>
                  </div>
                </Link>
              );
            })}
          </ul>
        </Card>

        <Card className="mulki-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">التواصل الداخلي</h3>
            <button onClick={() => router.push("/network")} className="size-7 rounded-md bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25"><Plus className="size-4" /></button>
          </div>
          <div className="flex gap-2 mb-3 text-xs">
            {(Object.keys(COMMS) as CommsTab[]).map((t) => (
              <button key={t} onClick={() => setCommsTab(t)}
                className={`rounded-md px-3 py-1 transition-colors ${commsTab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-background/40"}`}>{t}</button>
            ))}
          </div>
          <ul className="space-y-2">
            {COMMS[commsTab].map((c, i) => (
              <li key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/40 transition-colors">
                <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0"><MessageSquare className="size-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs flex items-center gap-1 flex-wrap">
                    <span className="font-semibold">{c.from}</span>
                    <span className="text-muted-foreground">←</span>
                    <span className="text-primary">{c.to}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{c.msg}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-muted-foreground">{c.time}</div>
                  <div className="inline-flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold mt-0.5">{c.badge}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/network" className="mt-3 block text-center rounded-lg border border-primary/40 bg-primary/10 text-primary py-2 text-xs">فتح مركز التواصل</Link>
        </Card>
      </div>

      {/* Action bar */}
      <Card className="mulki-card p-4">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {actionBar.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={a.action}
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background/30 py-3 hover:border-primary/40 transition-colors">
                <div className="size-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${a.color}20`, color: a.color }}>
                  <Icon className="size-5" />
                </div>
                <span className="text-xs">{a.label}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
