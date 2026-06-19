"use client";

import { useState } from "react";
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

// ---------------- Mock data ----------------
type ClientRow = {
  id: string;
  client_name: string;
  organization_name: string;
  subscription_plan: string | null;
  subscription_status: "active" | "trial" | "inactive" | "cancelled";
  registration_date: string;
  last_activity_at: string | null;
  account_manager_name: string | null;
};

type AccountManagerRow = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  position: string | null;
  created_at: string;
};

const MOCK_CLIENTS: ClientRow[] = [
  {
    id: "c1", client_name: "محمد العتيبي", organization_name: "مؤسسة الريادة التجارية",
    subscription_plan: "الباقة الاحترافية", subscription_status: "active",
    registration_date: "2026-01-12", last_activity_at: "2026-06-17", account_manager_name: "سارة القحطاني",
  },
  {
    id: "c2", client_name: "نورة الدوسري", organization_name: "شركة آفاق المستقبل",
    subscription_plan: "الباقة الأساسية", subscription_status: "trial",
    registration_date: "2026-05-28", last_activity_at: "2026-06-18", account_manager_name: null,
  },
  {
    id: "c3", client_name: "خالد المطيري", organization_name: "مجموعة النخبة القابضة",
    subscription_plan: "الباقة المؤسسية", subscription_status: "inactive",
    registration_date: "2025-11-03", last_activity_at: "2026-03-09", account_manager_name: "سارة القحطاني",
  },
  {
    id: "c4", client_name: "عبدالله الشهري", organization_name: "مكتب الإنجاز للاستشارات",
    subscription_plan: null, subscription_status: "cancelled",
    registration_date: "2025-09-21", last_activity_at: null, account_manager_name: null,
  },
];

const MOCK_MANAGERS: AccountManagerRow[] = [
  {
    id: "m1", name: "سارة القحطاني", email: "sara@partner.sa", mobile: "0551234567",
    position: "مدير حسابات أول", created_at: "2026-02-01",
  },
  {
    id: "m2", name: "فهد الزهراني", email: "fahad@partner.sa", mobile: "0509876543",
    position: "مدير حسابات", created_at: "2026-04-15",
  },
];

const MOCK_STATS = {
  totalReferrals: 24,
  activeClients: 14,
  inactiveClients: 6,
  monthlyRevenue: 48200,
  totalCommissions: 132500,
  pendingCommissions: 18400,
  paidCommissions: 114100,
  commissionRate: 15,
};

export default function AffiliatePage() {
  // المالك مُعتمد كشريك — نعرض مساحة العمل مباشرة (تصميم بصري فقط)
  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <PartnerWorkspace />
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
function PartnerWorkspace() {
  const [tab, setTab] = useState<"dashboard" | "clients" | "managers">("dashboard");
  const tabs: { value: "dashboard" | "clients" | "managers"; label: string }[] = [
    { value: "dashboard", label: "لوحة التحكم" },
    { value: "clients", label: "عملائي" },
    { value: "managers", label: "مدراء الحسابات" },
  ];
  return (
    <div className="space-y-6">
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
      {tab === "dashboard" && <DashboardTab />}
      {tab === "clients" && <ClientsTab />}
      {tab === "managers" && <ManagersTab />}
    </div>
  );
}

// ---------------- Dashboard tab ----------------
function DashboardTab() {
  const stats = MOCK_STATS;
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
function ClientsTab() {
  const clients = MOCK_CLIENTS;

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
function ManagersTab() {
  const [managers, setManagers] = useState<AccountManagerRow[]>(MOCK_MANAGERS);
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
