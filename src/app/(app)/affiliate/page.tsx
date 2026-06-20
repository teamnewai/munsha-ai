"use client";

import { useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Users, UserCheck, UserX, DollarSign, Clock, CheckCircle2, TrendingUp,
  Handshake, Plus, Trash2, Eye, MessageSquare, KeyRound, LifeBuoy, Loader2,
  type LucideIcon,
} from "lucide-react";
import { getAffiliateData, type AffiliateClient as ClientRow, type AffiliateManager as AccountManagerRow, type AffiliateStats, type AffiliateData } from "@/app/actions/affiliate";

export default function AffiliatePage() {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getAffiliateData().then((d) => { if (alive) { setData(d); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center min-h-[40vh]" dir="rtl">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.isAffiliate) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <Card className="mulki-card p-12 text-center max-w-lg mx-auto">
          <Handshake className="size-12 text-primary mx-auto mb-4" />
          <h2 className="font-display text-2xl font-semibold mb-2">برنامج الشريك التابع</h2>
          <p className="text-muted-foreground text-sm mb-6">
            لم يتم تسجيلك كشريك تابع بعد. عند اعتماد حسابك كشريك ستظهر هنا إحالاتك وعمولاتك ومندوبوك.
          </p>
          <Button onClick={() => toast.info("سيتواصل معك فريق الشراكات لإكمال التسجيل.")}>
            <Plus className="size-4 ms-2" /> طلب الانضمام كشريك
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <PartnerWorkspace stats={data.stats} clients={data.clients} initialManagers={data.managers} refCode={data.refCode} />
    </div>
  );
}

// ---------------- Inline UI helpers ----------------
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium leading-none ${className ?? ""}`}>{children}</label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

// ---------------- Partner workspace (inline Tabs) ----------------
function PartnerWorkspace({ stats, clients, initialManagers, refCode }: {
  stats: AffiliateStats; clients: ClientRow[]; initialManagers: AccountManagerRow[]; refCode: string | null;
}) {
  const [tab, setTab] = useState<"dashboard" | "clients" | "managers">("dashboard");
  const tabs: { value: "dashboard" | "clients" | "managers"; label: string }[] = [
    { value: "dashboard", label: "لوحة التحكم" },
    { value: "clients", label: "عملائي" },
    { value: "managers", label: "مدراء الحسابات" },
  ];
  return (
    <div className="space-y-6">
      {refCode && (
        <Card className="mulki-card p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">رمز الإحالة الخاص بك: </span>
            <span className="font-mono font-bold text-primary">{refCode}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(refCode); toast.success("نُسخ رمز الإحالة."); }}>نسخ الرمز</Button>
        </Card>
      )}
      <div className="grid grid-cols-3 max-w-xl items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              tab === t.value ? "bg-background text-foreground shadow-sm" : ""
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <DashboardTab stats={stats} />}
      {tab === "clients" && <ClientsTab clients={clients} />}
      {tab === "managers" && <ManagersTab initialManagers={initialManagers} />}
    </div>
  );
}

// ---------------- Dashboard tab ----------------
function DashboardTab({ stats }: { stats: AffiliateStats }) {
  const sar = (n: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="إجمالي الإحالات" value={stats.totalReferrals} tone="primary" />
        <StatCard icon={UserCheck} label="العملاء النشطون" value={stats.activeClients} tone="success" />
        <StatCard icon={UserX} label="العملاء غير النشطين" value={stats.inactiveClients} tone="muted" />
        <StatCard icon={TrendingUp} label="الإيراد الشهري" value={sar(stats.monthlyRevenue)} tone="primary" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="إجمالي العمولات" value={sar(stats.totalCommissions)} tone="primary" />
        <StatCard icon={Clock} label="عمولات معلّقة" value={sar(stats.pendingCommissions)} tone="warn" />
        <StatCard icon={CheckCircle2} label="عمولات مدفوعة" value={sar(stats.paidCommissions)} tone="success" />
        <StatCard icon={Handshake} label="نسبة العمولة" value={`${stats.commissionRate}%`} tone="muted" />
      </div>

      <Card className="mulki-card p-6">
        <h3 className="font-display text-lg font-semibold mb-1">سجل العمولات والأداء</h3>
        <p className="text-sm text-muted-foreground">
          ستظهر هنا التحليلات التفصيلية وسجل العمولات الشهرية فور تسجيل أول معاملة. المحفظة وطلبات السحب ستُفعَّل في المرحلة التالية.
        </p>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone,
}: { icon: LucideIcon; label: string; value: string | number; tone: "primary" | "success" | "warn" | "muted" }) {
  const toneCls = {
    primary: "text-primary",
    success: "text-emerald-500",
    warn: "text-amber-500",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <Card className="mulki-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${toneCls}`} />
      </div>
      <div className="font-display text-2xl font-semibold">{value}</div>
    </Card>
  );
}

// ---------------- Clients tab ----------------
function ClientsTab({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return (
      <Card className="mulki-card p-10 text-center">
        <Users className="size-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-display text-xl font-semibold mb-1">لا يوجد عملاء بعد</h3>
        <p className="text-muted-foreground text-sm">
          سيتم عرض العملاء الذين تمت إحالتهم عبر رابطك الخاص هنا تلقائيًا.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mulki-card overflow-hidden">
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b border-border transition-colors">
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">العميل</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">الجهة</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">الباقة</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">الحالة</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">التسجيل</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">آخر نشاط</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">مدير الحساب</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {clients.map((c) => <ClientRowView key={c.id} c={c} />)}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: ClientRow["subscription_status"] }) {
  const map: Record<ClientRow["subscription_status"], { cls: string; label: string }> = {
    active: { cls: "bg-emerald-500/15 text-emerald-600", label: "نشط" },
    trial: { cls: "bg-secondary text-secondary-foreground", label: "تجريبي" },
    inactive: { cls: "border border-border text-foreground", label: "غير نشط" },
    cancelled: { cls: "bg-destructive text-destructive-foreground", label: "ملغى" },
  };
  const { cls, label } = map[status];
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
  );
}

function ClientRowView({ c }: { c: ClientRow }) {
  return (
    <tr className="border-b border-border transition-colors hover:bg-muted/50">
      <td className="p-4 align-middle font-medium">{c.client_name}</td>
      <td className="p-4 align-middle">{c.organization_name}</td>
      <td className="p-4 align-middle">{c.subscription_plan ?? "—"}</td>
      <td className="p-4 align-middle"><StatusBadge status={c.subscription_status} /></td>
      <td className="p-4 align-middle text-sm text-muted-foreground">
        {new Date(c.registration_date).toLocaleDateString("ar-SA")}
      </td>
      <td className="p-4 align-middle text-sm text-muted-foreground">
        {c.last_activity_at ? new Date(c.last_activity_at).toLocaleDateString("ar-SA") : "—"}
      </td>
      <td className="p-4 align-middle">{c.account_manager_name ?? <span className="text-muted-foreground">غير معيّن</span>}</td>
      <td className="p-4 align-middle">
        <div className="flex gap-1">
          <ActionBtn icon={Eye} label="عرض" onClick={() => toast.info("صفحة العميل قيد التطوير")} />
          <ActionBtn icon={KeyRound} label="طلب وصول" onClick={() => toast.info("تدفق الوصول الآمن (OTP) في المرحلة التالية")} />
          <ActionBtn icon={MessageSquare} label="تواصل" onClick={() => toast.info("قناة التواصل قيد التطوير")} />
          <ActionBtn icon={LifeBuoy} label="طلب دعم" onClick={() => toast.info("مركز الدعم قيد التطوير")} />
        </div>
      </td>
    </tr>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" title={label} aria-label={label} onClick={onClick}>
      <Icon className="size-4" />
    </Button>
  );
}

// ---------------- Account managers tab ----------------
function ManagersTab({ initialManagers }: { initialManagers: AccountManagerRow[] }) {
  const [managers, setManagers] = useState<AccountManagerRow[]>(initialManagers);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", position: "", notes: "" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    const next: AccountManagerRow = {
      id: `m-${Date.now()}`,
      name: form.name,
      email: form.email,
      mobile: form.mobile || null,
      position: form.position || null,
      created_at: new Date().toISOString(),
    };
    setManagers((prev) => [next, ...prev]);
    toast.success("تم تسجيل مدير الحساب.");
    setOpen(false);
    setForm({ name: "", email: "", mobile: "", position: "", notes: "" });
    setSaving(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`حذف ${name}؟`)) {
      setManagers((prev) => prev.filter((m) => m.id !== id));
      toast.success("تم الحذف.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">مدراء الحسابات</h2>
          <p className="text-sm text-muted-foreground">سجّل مدراء الحسابات لتعيينهم على عملائك.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 ms-2" /> إضافة مدير حساب</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>تسجيل مدير حساب جديد</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={handleCreate}>
              <Field label="الاسم *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="البريد الإلكتروني *"><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="رقم الجوال"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
              <Field label="المنصب"><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
              <Field label="ملاحظات"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin ms-2" />}
                  حفظ
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {managers.length === 0 ? (
        <Card className="mulki-card p-10 text-center">
          <UserCheck className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">لا يوجد مدراء حسابات بعد. ابدأ بإضافة أول مدير.</p>
        </Card>
      ) : (
        <Card className="mulki-card overflow-hidden">
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b border-border transition-colors">
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">الاسم</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">البريد</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">الجوال</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">المنصب</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">تاريخ التسجيل</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right"></th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {managers.map((m) => (
                  <tr key={m.id} className="border-b border-border transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{m.name}</td>
                    <td className="p-4 align-middle">{m.email}</td>
                    <td className="p-4 align-middle">{m.mobile ?? "—"}</td>
                    <td className="p-4 align-middle">{m.position ?? "—"}</td>
                    <td className="p-4 align-middle text-sm text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="p-4 align-middle">
                      <Button
                        variant="ghost" size="icon" aria-label="حذف"
                        onClick={() => handleDelete(m.id, m.name)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
