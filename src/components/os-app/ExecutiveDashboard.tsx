import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, DollarSign, CheckCircle2, Users, AlertTriangle,
  Building2, Wallet, UserCheck, Megaphone, Settings as SettingsIcon, Briefcase,
  Monitor, FileText, BarChart3, PieChart, Phone, Video, ScreenShare, Radio,
  Send, Share2, Plus, ChevronDown, MessageSquare,
} from "lucide-react";

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
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform="rotate(-90 30 30)" />
      <text x="30" y="34" textAnchor="middle" className="fill-foreground" fontSize="13" fontWeight="600">{value}%</text>
    </svg>
  );
}

export function ExecutiveDashboard({ tenantName }: { tenantName: string }) {
  const heroStats = [
    { label: "إجمالي الإيرادات", value: "2,458,000", change: "+15.6%", color: "#10b981", icon: TrendingUp },
    { label: "إجمالي المصروفات", value: "1,125,000", change: "+8.3%", color: "#ef4444", icon: TrendingDown, down: true },
    { label: "إجمالي الأرباح", value: "1,333,000", change: "+21.4%", color: "#10b981", icon: DollarSign },
    { label: "المهام المكتملة", value: "85%", change: "+10%", color: "#3b82f6", icon: CheckCircle2, donut: 85 },
    { label: "الموظفون المتواجدون", value: "128 / 156", change: "متواجد الآن", color: "#8b5cf6", icon: Users },
    { label: "المهام المتأخرة", value: "23", change: "تحتاج متابعة", color: "#f59e0b", icon: AlertTriangle, isAlert: true },
  ] as const;

  const orgRoles = [
    { name: "المالية", icon: Wallet, color: "#10b981" },
    { name: "الموارد البشرية", icon: Users, color: "#3b82f6" },
    { name: "المبيعات", icon: BarChart3, color: "#ec4899" },
    { name: "التشغيل", icon: SettingsIcon, color: "#f59e0b" },
    { name: "التسويق", icon: Megaphone, color: "#ef4444" },
    { name: "الشؤون القانونية", icon: Briefcase, color: "#8b5cf6" },
    { name: "العقارات", icon: Building2, color: "#06b6d4" },
    { name: "تقنية المعلومات", icon: Monitor, color: "#6366f1" },
  ];

  const departments = [
    { name: "المالية", count: 12, open: 18, done: 142, perf: 92, color: "#10b981", icon: Wallet },
    { name: "الموارد البشرية", count: 8, open: 22, done: 108, perf: 88, color: "#3b82f6", icon: Users },
    { name: "المبيعات", count: 18, open: 31, done: 206, perf: 95, color: "#a855f7", icon: BarChart3 },
    { name: "التشغيل", count: 20, open: 27, done: 189, perf: 90, color: "#f59e0b", icon: SettingsIcon },
    { name: "التسويق", count: 8, open: 14, done: 74, perf: 85, color: "#ec4899", icon: Megaphone },
  ];

  const presentNow = [
    { name: "سارة القحطاني", role: "محاسبة أول", dept: "المالية", time: "09:10" },
    { name: "محمد الشهري", role: "أخصائي رواتب", dept: "الموارد البشرية", time: "09:05" },
    { name: "ناصر المطيري", role: "مندوب مبيعات", dept: "المبيعات", time: "09:12" },
    { name: "عبدالله السبيعي", role: "مدير العمليات", dept: "التشغيل", time: "09:08" },
    { name: "ريم العبيدي", role: "أخصائية تسويق", dept: "التسويق", time: "09:15" },
  ];

  const absent = [
    { name: "خالد الحربي", role: "مطور برامج", dept: "تقنية المعلومات" },
    { name: "علي الزهراني", role: "محلل مالي", dept: "المالية" },
  ];

  const reports = [
    { title: "التقرير المالي الشهري", date: "مايو 2024", icon: FileText, color: "#ef4444" },
    { title: "تقرير المبيعات التفصيلي", date: "مايو 2024", icon: BarChart3, color: "#3b82f6" },
    { title: "تقرير أداء الموظفين", date: "مايو 2024", icon: PieChart, color: "#a855f7" },
    { title: "تقرير المشاريع", date: "مايو 2024", icon: TrendingUp, color: "#10b981" },
  ];

  const comms = [
    { from: "المالية", to: "المبيعات", msg: "تم تحويل المبلغ للعميل رقم 1001", time: "10:30 AM", badge: 3 },
    { from: "الموارد البشرية", to: "التشغيل", msg: "طلب إجازة جديد من الموظف أحمد", time: "10:15 AM", badge: 2 },
    { from: "الرئيس التنفيذي", to: "جميع الموظفين", msg: "اجتماع يوم الأحد القادم", time: "09:00 AM", badge: 5 },
  ];

  const actionBar = [
    { label: "مكالمة صوتية", icon: Phone, color: "#10b981" },
    { label: "مكالمة فيديو", icon: Video, color: "#3b82f6" },
    { label: "شاشة ومتابعة", icon: ScreenShare, color: "#8b5cf6" },
    { label: "بث مباشر", icon: Radio, color: "#ec4899" },
    { label: "إرسال رسالة", icon: Send, color: "#f59e0b" },
    { label: "مشاركة ملف", icon: Share2, color: "#06b6d4" },
  ];

  return (
    <section className="space-y-6">
      <Card className="mulki-card p-6 relative overflow-hidden">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div className="text-right">
            <h2 className="font-display text-2xl md:text-3xl font-semibold">مرحباً بك، {tenantName || "أحمد بن محمد"}</h2>
            <p className="text-sm text-muted-foreground mt-1">إليك نظرة عامة على أداء منشآتك اليوم</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
            اليوم <ChevronDown className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {heroStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-background/30 p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="font-display text-xl md:text-2xl font-semibold mt-2" style={"isAlert" in s && s.isAlert ? { color: s.color } : undefined}>
                {s.value}
              </div>
              <div className="text-[11px] mt-1" style={{ color: s.color }}>{s.change}</div>
              <div className="mt-2">
                {"donut" in s && s.donut !== undefined ? (
                  <div className="flex justify-center"><Donut value={s.donut} color={s.color} /></div>
                ) : "isAlert" in s && s.isAlert ? (
                  <div className="flex justify-center pt-1"><AlertTriangle className="size-8" style={{ color: s.color }} /></div>
                ) : (
                  <Sparkline color={s.color} down={"down" in s ? s.down : false} />
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-4">
        <Card className="mulki-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">الموظفون المتواجدون الآن</h3>
            <UserCheck className="size-4 text-primary" />
          </div>
          <ul className="space-y-3">
            {presentNow.map((p) => (
              <li key={p.name} className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {p.name.charAt(0)}
                </div>
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
            <div className="text-xs text-muted-foreground mb-2">الموظفون غير المتواجدين</div>
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
              <div className="text-sm font-semibold">{tenantName || "أحمد بن محمد"}</div>
              <div className="text-[11px] text-muted-foreground">الرئيس التنفيذي</div>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 w-full">
              {orgRoles.map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.name} className="flex flex-col items-center gap-1.5">
                    <div className="size-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${r.color}20`, color: r.color }}>
                      <Icon className="size-5" />
                    </div>
                    <div className="text-[10px] text-center text-muted-foreground leading-tight">{r.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <div>
        <h3 className="font-display text-sm uppercase tracking-[0.22em] text-muted-foreground mb-3">الإدارات</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {departments.map((d) => {
            const Icon = d.icon;
            return (
              <Card key={d.name} className="mulki-card p-4 relative overflow-hidden">
                <div className="absolute -top-8 -end-8 size-24 rounded-full blur-2xl opacity-30" style={{ backgroundColor: d.color }} />
                <div className="relative flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-display font-semibold" style={{ color: d.color }}>{d.name}</div>
                    <div className="text-[11px] text-muted-foreground">{d.count} موظف</div>
                  </div>
                  <div className="size-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${d.color}20`, color: d.color }}>
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
                <Link href="/org" className="mt-3 block text-center rounded-lg border border-border/60 py-1.5 text-xs hover:border-primary/50 transition-colors">
                  دخول الإدارة
                </Link>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="mulki-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">التقارير الذكية</h3>
            <Link href="/command-center" className="text-xs text-primary">عرض الكل</Link>
          </div>
          <ul className="space-y-2">
            {reports.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.title} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/40 transition-colors">
                  <div className="size-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${r.color}20`, color: r.color }}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.date}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="mulki-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">التواصل الداخلي</h3>
            <button className="size-7 rounded-md bg-primary/15 text-primary flex items-center justify-center"><Plus className="size-4" /></button>
          </div>
          <div className="flex gap-2 mb-3 text-xs">
            <button className="rounded-md px-3 py-1 bg-primary/15 text-primary">اجتماعات</button>
            <button className="rounded-md px-3 py-1 text-muted-foreground hover:bg-background/40">مكالمات</button>
            <button className="rounded-md px-3 py-1 text-muted-foreground hover:bg-background/40">رسائل</button>
          </div>
          <ul className="space-y-2">
            {comms.map((c, i) => (
              <li key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/40 transition-colors">
                <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <MessageSquare className="size-4" />
                </div>
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
          <Link href="/network" className="mt-3 block text-center rounded-lg border border-primary/40 bg-primary/10 text-primary py-2 text-xs">
            فتح مركز التواصل
          </Link>
        </Card>
      </div>

      <Card className="mulki-card p-4">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {actionBar.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background/30 py-3 hover:border-primary/40 transition-colors">
                <div className="size-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${a.color}20`, color: a.color }}>
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
