"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Bell, Mail, Calendar, Search, Plus, ArrowLeft, ArrowRight,
  Info, User, Users, Phone, FileText, Folder, ClipboardList,
  Armchair, StickyNote, Calculator, CalendarDays, MessageSquare,
  PhoneCall, BarChart3, Clock, Umbrella, Settings,
  Printer, ScanLine, Camera, HardDrive, Mic, LayoutDashboard,
  Calculator as CalcIcon, Repeat, Bot, Inbox, Send, Signature,
  ShieldCheck, Building2, Target, Wallet, Car, FileType2,
  FileSpreadsheet, Presentation, Mail as MailIcon,
} from "lucide-react";
import { OfficeAppsProvider, useOfficeApps, type OfficeAppId } from "@/components/os-app/office-apps";
import { DEMO_LABEL } from "@/lib/os-data";
import { toast } from "@/lib/toast";

export default function OfficePage() {
  return (
    <OfficeAppsProvider>
      <div className="space-y-6" dir="rtl">
        <HeaderBar />
        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-12 lg:col-span-3 space-y-4 order-1 lg:order-3">
            <FilesCabinet />
            <FormsList />
            <OfficeTools />
            <button onClick={() => toast.info("تم فتح نموذج الإبلاغ عن مشكلة")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl mulki-gold-bg px-4 py-3 text-sm font-bold hover:opacity-90">
              ⚠ أبلغ عن مشكلة
            </button>
          </aside>
          <main className="col-span-12 lg:col-span-6 space-y-4 order-2">
            <ReturnedTransactions />
            <BigIconRow />
            <MediumIconRow />
            <BottomKpiRow />
            <NewVirtualOfficeRow />
          </main>
          <aside className="col-span-12 lg:col-span-3 space-y-4 order-3 lg:order-1">
            <DailyTasks />
            <RemindersCard />
            <RecentFiles />
          </aside>
        </div>
      </div>
    </OfficeAppsProvider>
  );
}

function HeaderBar() {
  const items: { to: string; Icon: LucideIcon; label: string; badge?: number }[] = [
    { to: "/notifications", Icon: Bell, label: "الإشعارات", badge: 0 },
    { to: "/workflows", Icon: Mail, label: "البريد" },
    { to: "/meetings", Icon: Calendar, label: "التقويم" },
    { to: "/knowledge", Icon: Search, label: "البحث" },
  ];
  return (
    <Card className="mulki-card p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        {items.map(({ to, Icon, label, badge }) => (
          <Link key={label} href={to} aria-label={label}
            className="relative size-11 grid place-items-center rounded-xl border border-border bg-background/50 hover:border-primary/60 hover:bg-sidebar-accent/30 transition-colors">
            <Icon className="size-5 text-foreground/80" />
            {badge ? (
              <span className="absolute -top-1 -right-1 size-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">{badge}</span>
            ) : null}
          </Link>
        ))}
      </div>
      <div className="text-center flex-1 min-w-[200px]">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">المكتب الافتراضي</h1>
        <p className="text-xs text-muted-foreground mt-0.5">لوحة التحكم الرئيسية</p>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2">
        <div className="text-end">
          <div className="text-sm font-medium">مدير المكتب</div>
          <div className="text-xs text-muted-foreground">المالك</div>
        </div>
        <div className="size-9 rounded-full bg-primary/20 grid place-items-center"><User className="size-5 text-primary" /></div>
      </div>
    </Card>
  );
}

function SectionCard({ title, accent, addTo, children }: { title: string; accent?: "primary" | "destructive"; addTo?: string; children: React.ReactNode }) {
  const ring = accent === "destructive" ? "border-destructive/40" : "";
  const titleColor = accent === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card className={`mulki-card p-4 ${ring}`}>
      <div className="flex items-center justify-between mb-3">
        <Link href={addTo ?? "/office"} aria-label="إضافة" className="size-8 grid place-items-center rounded-lg bg-primary/15 hover:bg-primary/25 transition-colors">
          <Plus className="size-4 text-primary" />
        </Link>
        <h2 className={`font-display text-base font-semibold ${titleColor}`}>{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function DailyTasks() {
  const items = [
    { Icon: Info, label: "المعلومات غير المنجزة", value: DEMO_LABEL, tone: "text-primary bg-primary/15" },
    { Icon: User, label: "الإحالات من المدير", value: DEMO_LABEL, tone: "text-accent bg-accent/15" },
    { Icon: Users, label: "الإحالات من الأقسام الأخرى", value: DEMO_LABEL, tone: "text-blue-400 bg-blue-500/15" },
    { Icon: Phone, label: "معاملات الهاتف", value: DEMO_LABEL, tone: "text-emerald-400 bg-emerald-500/15" },
  ];
  return (
    <SectionCard title="المهام اليومية" addTo="/workflows">
      <ul className="space-y-2">
        {items.map(({ Icon, label, value, tone }) => (
          <li key={label} className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-2.5">
            <span className="text-sm tabular-nums font-semibold text-muted-foreground">{value}</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm truncate">{label}</span>
              <span className={`size-8 grid place-items-center rounded-full ${tone}`}><Icon className="size-4" /></span>
            </div>
          </li>
        ))}
      </ul>
      <Link href="/workflows" className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-border py-2 text-sm hover:bg-sidebar-accent/30 transition-colors">
        <ArrowLeft className="size-3.5" /> عرض الكل
      </Link>
    </SectionCard>
  );
}

function RemindersCard() {
  const items = [
    { time: "10:00 ص", title: "اجتماع مع المدير" },
    { time: "12:30 م", title: "تسليم التقرير الشهري" },
    { time: "03:00 م", title: "متابعة طلب الإجازة" },
  ];
  return (
    <SectionCard title="المهام والتذكير" addTo="/meetings">
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.title} className="flex items-center justify-between text-sm">
            <span className="text-xs text-muted-foreground tabular-nums">{it.time}</span>
            <span className="truncate">{it.title}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function RecentFiles() {
  const files = [
    { name: "تقرير المبيعات.pdf", ago: "منذ 10 دقائق", ext: "PDF" },
    { name: "الميزانية.xlsx", ago: "منذ ساعة", ext: "XLS" },
    { name: "المشروع.docx", ago: "منذ 3 ساعات", ext: "DOC" },
  ];
  return (
    <SectionCard title="الملفات الأخيرة" addTo="/knowledge">
      <ul className="space-y-2">
        {files.map((f) => (
          <li key={f.name} className="flex items-center gap-2 text-sm">
            <span className="size-8 rounded-md bg-primary/15 text-primary text-[10px] font-bold grid place-items-center shrink-0">{f.ext}</span>
            <div className="min-w-0 flex-1 text-end">
              <div className="truncate">{f.name}</div>
              <div className="text-[11px] text-muted-foreground">{f.ago}</div>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ReturnedTransactions() {
  const rows = [
    { id: 1254, date: "2024/05/20", note: "تم إرجاعها من المدير المباشر", tone: "عاجل", toneCls: "bg-destructive/20 text-destructive" },
    { id: 1253, date: "2024/05/19", note: "تم إرجاعها من القسم المالي", tone: "متوسط", toneCls: "bg-amber-500/20 text-amber-400" },
    { id: 1252, date: "2024/05/18", note: "تم إرجاعها من الموارد البشرية", tone: "عادي", toneCls: "bg-blue-500/20 text-blue-400" },
    { id: 1251, date: "2024/05/17", note: "تم إرجاعها من القسم الإداري", tone: "متوسط", toneCls: "bg-amber-500/20 text-amber-400" },
  ];
  return (
    <SectionCard title="المعاملات المرتجعة" accent="destructive" addTo="/workflows">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5">
            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${r.toneCls}`}>{r.tone}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{r.date}</span>
            <div className="flex-1 min-w-0 text-end">
              <div className="text-sm font-medium">معاملة رقم {r.id}</div>
              <div className="text-[11px] text-muted-foreground truncate">{r.note}</div>
            </div>
            <span className="size-9 rounded-md bg-destructive/10 text-destructive grid place-items-center shrink-0"><FileText className="size-4" /></span>
          </li>
        ))}
      </ul>
      <Link href="/workflows" className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-border py-2 text-sm hover:bg-sidebar-accent/30 transition-colors">
        <ArrowLeft className="size-3.5" /> عرض الكل
      </Link>
    </SectionCard>
  );
}

type Tint = "primary" | "accent" | "emerald" | "blue" | "rose" | "amber";

function BigTile({ to, app, label, Icon, tint = "primary", children }: {
  to?: string; app?: OfficeAppId; label: string; Icon: LucideIcon; tint?: Tint; children?: React.ReactNode;
}) {
  const tints: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 text-primary",
    accent: "from-accent/30 to-accent/5 text-accent",
    emerald: "from-emerald-500/25 to-emerald-500/5 text-emerald-400",
    blue: "from-blue-500/25 to-blue-500/5 text-blue-400",
    rose: "from-rose-500/25 to-rose-500/5 text-rose-400",
    amber: "from-amber-500/25 to-amber-500/5 text-amber-400",
  };
  const { open } = useOfficeApps();
  const inner = (
    <Card className="mulki-card p-3 h-full hover:border-primary/60 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <Plus className="size-3.5 text-primary/70" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`aspect-square rounded-xl bg-gradient-to-br ${tints[tint]} grid place-items-center relative overflow-hidden`}>
        <Icon className="size-12 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
      </div>
      {children && <div className="mt-1.5 text-center text-[11px] text-muted-foreground">{children}</div>}
    </Card>
  );
  if (app) return <button type="button" onClick={() => open(app)} className="group block text-right w-full">{inner}</button>;
  return <Link href={to ?? "/office"} className="group block">{inner}</Link>;
}

function BigIconRow() {
  const { open } = useOfficeApps();
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <button type="button" onClick={() => open("office-suite")} className="text-right">
        <Card className="mulki-card p-3 hover:border-primary/60 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <Plus className="size-3.5 text-primary/70" />
            <span className="text-xs font-medium">برامج الأوفيس</span>
          </div>
          <div className="aspect-square rounded-xl bg-gradient-to-br from-blue-500/20 to-primary/5 grid grid-cols-2 gap-2 p-3">
            {[
              { Icon: FileType2, cls: "text-blue-500" },
              { Icon: FileSpreadsheet, cls: "text-emerald-500" },
              { Icon: Presentation, cls: "text-orange-500" },
              { Icon: MailIcon, cls: "text-sky-400" },
            ].map(({ Icon, cls }, i) => (
              <div key={i} className="rounded-md bg-background/60 grid place-items-center"><Icon className={`size-7 ${cls}`} strokeWidth={1.5} /></div>
            ))}
          </div>
        </Card>
      </button>
      <BigTile app="guest-chair" label="كرسي الضيف" Icon={Armchair} tint="accent" />
      <BigTile app="notes" label="مذكرات صفر" Icon={StickyNote} tint="amber" />
      <BigTile app="calculator" label="الآلة الحاسبة" Icon={Calculator} tint="blue" />
      <BigTile to="/meetings" label="التقويم" Icon={CalendarDays} tint="emerald" />
    </div>
  );
}

function MediumTile({ to, app, label, Icon, sub, badge, tint }: {
  to?: string; app?: OfficeAppId; label: string; Icon: LucideIcon; sub?: string; badge?: number; tint: Tint;
}) {
  const tints: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    accent: "text-accent bg-accent/15",
    emerald: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    rose: "text-rose-400 bg-rose-500/10",
    amber: "text-amber-400 bg-amber-500/10",
  };
  const { open } = useOfficeApps();
  const inner = (
    <Card className="mulki-card p-3 h-full hover:border-primary/60 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <Plus className="size-3.5 text-primary/70" />
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <div className={`h-20 rounded-lg ${tints[tint]} grid place-items-center relative`}>
        <Icon className="size-9" strokeWidth={1.5} />
        {badge ? <span className="absolute top-1 right-1 size-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">{badge}</span> : null}
      </div>
      {sub && <div className="mt-1 text-center text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
  if (app) return <button type="button" onClick={() => open(app)} className="text-right w-full">{inner}</button>;
  return <Link href={to ?? "/office"}>{inner}</Link>;
}

function MediumIconRow() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <MediumTile app="notes" label="الملاحظات" Icon={StickyNote} tint="amber" />
      <MediumTile app="email" label="البريد الإلكتروني" Icon={MailIcon} tint="rose" badge={0} sub={DEMO_LABEL} />
      <MediumTile app="chat" label="المحادثات الداخلية" Icon={MessageSquare} tint="blue" sub="متصل" />
      <MediumTile app="calls" label="سجل المكالمات" Icon={PhoneCall} tint="emerald" sub={DEMO_LABEL} />
      <MediumTile to="/reports" label="المهام الخاصة بي" Icon={BarChart3} tint="primary" />
    </div>
  );
}

function BottomKpiRow() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card className="mulki-card p-3">
        <div className="flex items-center justify-between mb-2">
          <Plus className="size-3.5 text-primary/70" />
          <span className="text-xs font-medium">المهام الخاصة بي</span>
        </div>
        <ul className="space-y-1.5 text-[11px]">
          {[
            { l: "إعداد التقرير الشهري", v: 70, c: "bg-primary" },
            { l: "مراجعة الميزانية", v: 40, c: "bg-emerald-500" },
            { l: "متابعة الموردين", v: 90, c: "bg-blue-500" },
            { l: "تجهيز اجتماع الإدارة", v: 20, c: "bg-rose-500" },
          ].map((t) => (
            <li key={t.l}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="tabular-nums">{t.v}%</span>
                <span className="truncate">{t.l}</span>
              </div>
              <div className="h-1 rounded-full bg-border overflow-hidden"><div className={`h-full ${t.c}`} style={{ width: `${t.v}%` }} /></div>
            </li>
          ))}
        </ul>
      </Card>
      <MediumTile app="hours" label="ساعات العمل" Icon={Clock} tint="emerald" sub="05:30:45 ساعات اليوم" />
      <MediumTile app="leave" label="الإجازات" Icon={Umbrella} tint="amber" sub="12 الرصيد المتبقي" />
      <MediumTile to="/settings" label="الإعدادات" Icon={Settings} tint="primary" sub="تخصيص إعدادات المكتب" />
    </div>
  );
}

function NewVirtualOfficeRow() {
  const items: { to?: string; app?: OfficeAppId; label: string; Icon: LucideIcon; tint: Tint; sub?: string }[] = [
    { to: "/noor", label: "المساعد الذكي", Icon: Bot, tint: "accent", sub: "نور AI" },
    { to: "/service-requests", label: "مركز طلبات الخدمات", Icon: ClipboardList, tint: "primary", sub: "طلب أي خدمة" },
    { to: "/workflows", label: "الوارد", Icon: Inbox, tint: "blue" },
    { to: "/workflows", label: "الصادر", Icon: Send, tint: "emerald" },
    { to: "/forms", label: "التوقيع الإلكتروني", Icon: Signature, tint: "primary" },
    { to: "/permissions", label: "الصلاحيات", Icon: ShieldCheck, tint: "rose", sub: "يمنحها المالك" },
    { to: "/org", label: "القائمة", Icon: Building2, tint: "blue" },
    { to: "/reports", label: "مؤشرات الأداء KPI", Icon: BarChart3, tint: "emerald" },
    { to: "/governance", label: "الأهداف السنوية", Icon: Target, tint: "primary" },
    { to: "/service-requests", label: "العهد والسلف", Icon: Wallet, tint: "amber" },
    { app: "vehicles", label: "إدارة المركبات", Icon: Car, tint: "accent" },
  ];
  return (
    <Card className="mulki-card p-4">
      <div className="flex items-center justify-between mb-3">
        <Link href="/office" className="size-8 grid place-items-center rounded-lg bg-primary/15 hover:bg-primary/25 transition-colors">
          <Plus className="size-4 text-primary" />
        </Link>
        <h2 className="font-display text-base font-semibold text-primary">المكتب الافتراضي المتكامل</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {items.map((it) => <MediumTile key={it.label} {...it} />)}
      </div>
    </Card>
  );
}

function FilesCabinet() {
  const folders = [
    { label: "المعاملات العامة", to: "/workflows" },
    { label: "الشؤون الإدارية", to: "/governance" },
    { label: "الشؤون المالية", to: "/reports" },
    { label: "الموارد البشرية", to: "/people" },
    { label: "العقود والاتفاقيات", to: "/knowledge" },
    { label: "المراسلات", to: "/workflows" },
    { label: "أرشيف قديم", to: "/knowledge" },
  ];
  return (
    <SectionCard title="دولاب الملفات" addTo="/knowledge">
      <ul className="space-y-1.5">
        {folders.map((f) => (
          <li key={f.label}>
            <Link href={f.to} className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-sidebar-accent/30 transition-colors">
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm truncate">{f.label}</span>
                <span className="size-8 rounded-md bg-primary/10 grid place-items-center shrink-0"><Folder className="size-4 text-primary" /></span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function FormsList() {
  const forms = ["نموذج طلب إجازة", "نموذج صرف مستحقات", "نموذج مخاطبة داخلية", "نموذج تعهد", "نموذج تقرير", "نموذج متابعة"];
  return (
    <SectionCard title="النماذج" addTo="/forms">
      <ul className="space-y-1.5">
        {forms.map((f) => (
          <li key={f}>
            <Link href="/forms" className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-sidebar-accent/30 transition-colors">
              <span className="text-sm truncate">{f}</span>
              <span className="size-7 rounded-md bg-accent/15 grid place-items-center shrink-0"><ClipboardList className="size-3.5 text-accent" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function OfficeTools() {
  const { open } = useOfficeApps();
  const tools: { Icon: LucideIcon; label: string; app: OfficeAppId }[] = [
    { Icon: Printer, label: "الطابعة", app: "printer" },
    { Icon: ScanLine, label: "الماسح الضوئي", app: "scanner" },
    { Icon: Camera, label: "آلة التصوير", app: "camera" },
    { Icon: HardDrive, label: "فلاش ميموري", app: "flash" },
    { Icon: Mic, label: "الملاحظات الصوتية", app: "voice-memo" },
    { Icon: LayoutDashboard, label: "لوحة بيضاء", app: "whiteboard" },
    { Icon: CalcIcon, label: "حاسبة تاريخ", app: "date-calc" },
    { Icon: Repeat, label: "تحويل/دمج الملفات", app: "merge" },
  ];
  return (
    <SectionCard title="أدوات المكتب" addTo="/office">
      <div className="grid grid-cols-4 gap-2">
        {tools.map(({ Icon, label, app }) => (
          <button key={label} type="button" onClick={() => open(app)}
            className="flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-sidebar-accent/30 transition-colors text-center">
            <span className="size-10 rounded-lg bg-primary/10 grid place-items-center"><Icon className="size-5 text-primary" strokeWidth={1.5} /></span>
            <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
