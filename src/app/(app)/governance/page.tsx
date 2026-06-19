"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/uikit/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ShieldCheck, Search, Plus, Trash2, ScrollText, FileStack, Network, Scale } from "lucide-react";

// ---------------- inlined primitives ----------------
function Badge({
  variant = "default", className, children,
}: { variant?: "default" | "outline" | "secondary" | "destructive"; className?: string; children: React.ReactNode }) {
  const cls =
    variant === "outline" ? "border border-border text-foreground" :
    variant === "secondary" ? "bg-secondary text-secondary-foreground" :
    variant === "destructive" ? "bg-destructive text-destructive-foreground" :
    "mulki-gold-bg";
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", cls, className)}>{children}</span>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium block mb-1.5">{children}</label>;
}

function Select<T extends string>({
  value, onValueChange, options,
}: { value: T; onValueChange: (v: T) => void; options: readonly T[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value as T)}
      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "mulki-gold-bg" : "bg-border",
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-background transition-transform", checked ? "translate-x-1" : "translate-x-6")} />
    </button>
  );
}

const TABS = [
  { value: "audit", label: "سجل التدقيق", Icon: ScrollText },
  { value: "authority", label: "مصفوفة الصلاحيات", Icon: Scale },
  { value: "raci", label: "مصفوفة RACI", Icon: Network },
  { value: "cycles", label: "دورات المستندات", Icon: FileStack },
] as const;

export default function GovernancePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("audit");
  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="space-y-6">
        <div className="grid grid-cols-4 w-full max-w-3xl rounded-lg border border-border bg-muted/40 p-1">
          {TABS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "flex items-center justify-center rounded-md py-2 text-sm font-medium transition-colors",
                tab === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4 ms-2" />{label}
            </button>
          ))}
        </div>
        {tab === "audit" && <AuditTab />}
        {tab === "authority" && <AuthorityTab />}
        {tab === "raci" && <RaciTab />}
        {tab === "cycles" && <CyclesTab />}
      </div>
    </div>
  );
}

// ---------------- Table primitives ----------------
function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-sm">{children}</table>;
}
function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-muted/40">{children}</thead>;
}
function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}
function TR({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-border last:border-0">{children}</tr>;
}
function TH({ children }: { children?: React.ReactNode }) {
  return <th className="text-start font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">{children}</th>;
}
function TD({ className, colSpan, children }: { className?: string; colSpan?: number; children?: React.ReactNode }) {
  return <td colSpan={colSpan} className={cn("px-3 py-2 align-middle", className)}>{children}</td>;
}

// ---------------- AUDIT LOG ----------------
type AuditRow = {
  id: string; created_at: string; actor_name: string | null; actor_label: string | null;
  actor_kind: string; action: string; entity_type: string; entity_id: string | null; summary: string | null;
};

const AUDIT_ROWS: AuditRow[] = [
  { id: "a1", created_at: "2026-06-18T09:12:00Z", actor_name: "أحمد المالك", actor_label: null, actor_kind: "user", action: "approve", entity_type: "form", entity_id: "8f3a91c200", summary: "اعتماد نموذج طلب إجازة" },
  { id: "a2", created_at: "2026-06-18T08:40:00Z", actor_name: "نظام مُلكي", actor_label: null, actor_kind: "system", action: "create", entity_type: "workflow", entity_id: "1b22ce4400", summary: "إنشاء معاملة صرف مستحقات" },
  { id: "a3", created_at: "2026-06-17T15:05:00Z", actor_name: "سارة الإدارية", actor_label: null, actor_kind: "user", action: "update", entity_type: "policy", entity_id: "77ad0e1200", summary: "تحديث سياسة الشراء" },
  { id: "a4", created_at: "2026-06-17T11:30:00Z", actor_name: null, actor_label: "نور AI", actor_kind: "agent", action: "summarize", entity_type: "document", entity_id: "c901aa3300", summary: "تلخيص عقد المورد" },
];

function AuditTab() {
  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState("");
  const rows = AUDIT_ROWS.filter((r) => !entityType || r.entity_type === entityType);
  const filtered = rows.filter((r) =>
    !q || r.action.includes(q) || r.summary?.includes(q) || r.actor_name?.includes(q)
  );
  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> سجل التدقيق
        </h2>
        <div className="flex gap-2">
          <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="نوع الكيان (مثال: form)" className="w-48" />
          <div className="relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="pe-9 w-64" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>التاريخ</TH>
              <TH>الفاعل</TH>
              <TH>الإجراء</TH>
              <TH>الكيان</TH>
              <TH>الملخص</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 && <TR><TD colSpan={5} className="text-center text-muted-foreground py-8">لا توجد سجلات.</TD></TR>}
            {filtered.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("ar-SA")}</TD>
                <TD><div className="text-sm">{r.actor_name ?? r.actor_label ?? "—"}</div><div className="text-[10px] uppercase text-muted-foreground">{r.actor_kind}</div></TD>
                <TD><Badge variant="outline">{r.action}</Badge></TD>
                <TD className="text-xs"><span className="text-muted-foreground">{r.entity_type}</span>{r.entity_id ? <div className="font-mono text-[10px]">{r.entity_id.slice(0, 8)}…</div> : null}</TD>
                <TD className="text-sm">{r.summary ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}

// ---------------- AUTHORITY MATRIX ----------------
const SCOPES = ["financial", "operational", "hr", "it", "legal", "procurement", "governance"] as const;
const PRINCIPAL_KINDS = ["user", "role", "team", "department", "unit", "custom_role"] as const;

type AuthorityRow = {
  id: string; scope: string; action_key: string; action_label: string;
  principal_kind: string; principal_id: string; amount_limit: number | null;
  currency: string; escalate_above: number | null; active: boolean;
};

const AUTHORITY_ROWS: AuthorityRow[] = [
  { id: "au1", scope: "financial", action_key: "approve_purchase_order", action_label: "اعتماد أمر شراء", principal_kind: "role", principal_id: "mgr-finance-001", amount_limit: 50000, currency: "SAR", escalate_above: 100000, active: true },
  { id: "au2", scope: "hr", action_key: "approve_leave", action_label: "اعتماد إجازة", principal_kind: "department", principal_id: "hr-dept-001", amount_limit: null, currency: "SAR", escalate_above: null, active: true },
  { id: "au3", scope: "procurement", action_key: "sign_contract", action_label: "توقيع عقد", principal_kind: "user", principal_id: "owner-001", amount_limit: 250000, currency: "SAR", escalate_above: null, active: false },
];

function AuthorityTab() {
  const [rows, setRows] = useState<AuthorityRow[]>(AUTHORITY_ROWS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    scope: "financial" as (typeof SCOPES)[number],
    action_key: "", action_label: "",
    principal_kind: "role" as (typeof PRINCIPAL_KINDS)[number],
    principal_id: "", amount_limit: "", currency: "USD",
    escalate_above: "", notes: "", active: true,
  });
  const save = () => {
    setRows((prev) => [...prev, {
      id: `au${Date.now()}`, scope: form.scope, action_key: form.action_key, action_label: form.action_label,
      principal_kind: form.principal_kind, principal_id: form.principal_id,
      amount_limit: form.amount_limit ? Number(form.amount_limit) : null,
      currency: form.currency, escalate_above: form.escalate_above ? Number(form.escalate_above) : null,
      active: form.active,
    }]);
    toast.success("تم الحفظ");
    setOpen(false);
  };
  const del = (id: string) => { setRows((prev) => prev.filter((r) => r.id !== id)); toast.success("تم الحذف"); };

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Scale className="size-5 text-primary" /> مصفوفة الصلاحيات</h2>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 ms-2" />إضافة بند</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>بند صلاحية</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>النطاق</Label>
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })} options={SCOPES} />
              </div>
              <div><Label>كود الإجراء</Label><Input value={form.action_key} onChange={(e) => setForm({ ...form, action_key: e.target.value })} placeholder="approve_purchase_order" /></div>
              <div className="col-span-2"><Label>وصف الإجراء</Label><Input value={form.action_label} onChange={(e) => setForm({ ...form, action_label: e.target.value })} /></div>
              <div><Label>نوع المخوّل</Label>
                <Select value={form.principal_kind} onValueChange={(v) => setForm({ ...form, principal_kind: v })} options={PRINCIPAL_KINDS} />
              </div>
              <div><Label>معرّف المخوّل (UUID)</Label><Input value={form.principal_id} onChange={(e) => setForm({ ...form, principal_id: e.target.value })} /></div>
              <div><Label>سقف المبلغ</Label><Input type="number" value={form.amount_limit} onChange={(e) => setForm({ ...form, amount_limit: e.target.value })} /></div>
              <div><Label>العملة</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              <div><Label>تصعيد فوق</Label><Input type="number" value={form.escalate_above} onChange={(e) => setForm({ ...form, escalate_above: e.target.value })} /></div>
              <div className="flex items-end gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>فعّال</Label></div>
              <div className="col-span-2"><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <THead><TR>
            <TH>النطاق</TH><TH>الإجراء</TH><TH>المخوّل</TH>
            <TH>السقف</TH><TH>تصعيد فوق</TH><TH>الحالة</TH><TH></TH>
          </TR></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={7} className="text-center text-muted-foreground py-8">لا توجد بنود.</TD></TR>}
            {rows.map((r) => (
              <TR key={r.id}>
                <TD><Badge variant="outline">{r.scope}</Badge></TD>
                <TD><div className="font-medium text-sm">{r.action_label}</div><div className="text-[10px] text-muted-foreground font-mono">{r.action_key}</div></TD>
                <TD className="text-xs"><span className="text-muted-foreground">{r.principal_kind}</span><div className="font-mono">{r.principal_id.slice(0, 8)}…</div></TD>
                <TD className="text-sm">{r.amount_limit !== null ? `${r.amount_limit.toLocaleString()} ${r.currency}` : "—"}</TD>
                <TD className="text-sm">{r.escalate_above !== null ? `${r.escalate_above.toLocaleString()} ${r.currency}` : "—"}</TD>
                <TD><Badge variant={r.active ? "default" : "secondary"}>{r.active ? "فعّال" : "موقوف"}</Badge></TD>
                <TD><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="size-4 text-destructive" /></Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}

// ---------------- RACI ----------------
type RaciRow = {
  id: string; subject_type: string; subject_id: string; subject_label: string | null;
  principal_kind: string; principal_id: string; principal_label: string | null; raci: "R" | "A" | "C" | "I";
};

const RACI_ROWS: RaciRow[] = [
  { id: "r1", subject_type: "process", subject_id: "proc-purchase-001", subject_label: "دورة الشراء", principal_kind: "role", principal_id: "mgr-finance-001", principal_label: "مدير المالية", raci: "A" },
  { id: "r2", subject_type: "activity", subject_id: "act-review-001", subject_label: "مراجعة العقود", principal_kind: "department", principal_id: "legal-dept-001", principal_label: "الشؤون القانونية", raci: "C" },
  { id: "r3", subject_type: "project", subject_id: "proj-os-001", subject_label: "مشروع مُلكي OS", principal_kind: "user", principal_id: "owner-001", principal_label: "المالك", raci: "I" },
];

const SUBJECT_TYPES = ["activity", "process", "project", "department", "workflow"] as const;
const RACI_OPTS = ["R", "A", "C", "I"] as const;

function RaciTab() {
  const [rows, setRows] = useState<RaciRow[]>(RACI_ROWS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    subject_type: "activity" as (typeof SUBJECT_TYPES)[number], subject_id: "", subject_label: "",
    principal_kind: "role" as (typeof PRINCIPAL_KINDS)[number], principal_id: "", principal_label: "",
    raci: "R" as "R" | "A" | "C" | "I", notes: "",
  });
  const save = () => {
    setRows((prev) => [...prev, {
      id: `r${Date.now()}`, subject_type: form.subject_type, subject_id: form.subject_id, subject_label: form.subject_label || null,
      principal_kind: form.principal_kind, principal_id: form.principal_id, principal_label: form.principal_label || null, raci: form.raci,
    }]);
    toast.success("تم الحفظ");
    setOpen(false);
  };
  const del = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Network className="size-5 text-primary" /> مصفوفة RACI</h2>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 ms-2" />تعيين RACI</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>تعيين RACI</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>نوع الموضوع</Label>
                <Select value={form.subject_type} onValueChange={(v) => setForm({ ...form, subject_type: v })} options={SUBJECT_TYPES} />
              </div>
              <div><Label>RACI</Label>
                <Select value={form.raci} onValueChange={(v) => setForm({ ...form, raci: v })} options={RACI_OPTS} />
              </div>
              <div><Label>معرّف الموضوع (UUID)</Label><Input value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} /></div>
              <div><Label>وصف الموضوع</Label><Input value={form.subject_label} onChange={(e) => setForm({ ...form, subject_label: e.target.value })} /></div>
              <div><Label>نوع المسؤول</Label>
                <Select value={form.principal_kind} onValueChange={(v) => setForm({ ...form, principal_kind: v })} options={PRINCIPAL_KINDS} />
              </div>
              <div><Label>معرّف المسؤول (UUID)</Label><Input value={form.principal_id} onChange={(e) => setForm({ ...form, principal_id: e.target.value })} /></div>
              <div className="col-span-2"><Label>وصف المسؤول</Label><Input value={form.principal_label} onChange={(e) => setForm({ ...form, principal_label: e.target.value })} /></div>
              <div className="col-span-2"><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <THead><TR><TH>الموضوع</TH><TH>المسؤول</TH><TH>RACI</TH><TH></TH></TR></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={4} className="text-center text-muted-foreground py-8">لا توجد تعيينات.</TD></TR>}
            {rows.map((r) => (
              <TR key={r.id}>
                <TD><div className="text-sm">{r.subject_label ?? r.subject_id.slice(0, 8)}</div><div className="text-[10px] uppercase text-muted-foreground">{r.subject_type}</div></TD>
                <TD><div className="text-sm">{r.principal_label ?? r.principal_id.slice(0, 8)}</div><div className="text-[10px] uppercase text-muted-foreground">{r.principal_kind}</div></TD>
                <TD><Badge>{r.raci}</Badge></TD>
                <TD><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="size-4 text-destructive" /></Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}

// ---------------- DOCUMENT CYCLES ----------------
type CycleStage = { key: string; label: string };
type CycleRow = {
  id: string; name: string; description: string | null; document_type: string;
  stages: CycleStage[]; active: boolean;
};

const DOC_TYPES = ["policy", "sop", "contract", "memo", "procedure", "report"] as const;

const CYCLE_ROWS: CycleRow[] = [
  { id: "c1", name: "دورة اعتماد السياسات", description: "مسار اعتماد ونشر السياسات الداخلية", document_type: "policy", stages: [{ key: "draft", label: "draft" }, { key: "review", label: "review" }, { key: "approval", label: "approval" }, { key: "publish", label: "publish" }, { key: "archive", label: "archive" }], active: true },
  { id: "c2", name: "دورة العقود", description: null, document_type: "contract", stages: [{ key: "draft", label: "draft" }, { key: "legal", label: "legal" }, { key: "sign", label: "sign" }], active: false },
];

function CyclesTab() {
  const [rows, setRows] = useState<CycleRow[]>(CYCLE_ROWS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", document_type: "policy" as (typeof DOC_TYPES)[number],
    stages: "draft,review,approval,publish,archive", workflow_id: "", active: true,
  });
  const save = () => {
    setRows((prev) => [...prev, {
      id: `c${Date.now()}`, name: form.name, description: form.description || null, document_type: form.document_type,
      stages: form.stages.split(",").map((s) => ({ key: s.trim(), label: s.trim() })), active: form.active,
    }]);
    toast.success("تم الحفظ");
    setOpen(false);
  };
  const del = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><FileStack className="size-5 text-primary" /> دورات المستندات</h2>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 ms-2" />دورة جديدة</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>دورة مستند</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>نوع المستند</Label>
                <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })} options={DOC_TYPES} />
              </div>
              <div><Label>المراحل (مفصولة بفواصل)</Label><Input value={form.stages} onChange={(e) => setForm({ ...form, stages: e.target.value })} /></div>
              <div><Label>معرّف سير العمل (اختياري UUID)</Label><Input value={form.workflow_id} onChange={(e) => setForm({ ...form, workflow_id: e.target.value })} /></div>
              <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>فعّالة</Label></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.length === 0 && <Card className="p-8 text-center text-muted-foreground md:col-span-2">لا توجد دورات.</Card>}
        {rows.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.document_type} • {c.active ? "فعّالة" : "موقوفة"}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(c.id)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
            {c.description && <p className="text-sm text-muted-foreground mt-2">{c.description}</p>}
            <div className="flex flex-wrap gap-1 mt-3">
              {c.stages.map((s, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">{i + 1}. {s.label ?? s.key}</Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
