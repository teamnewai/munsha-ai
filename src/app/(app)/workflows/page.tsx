"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Workflow, Plus, Trash2, Upload, Play, Inbox, BarChart3, AlertTriangle,
  CheckCircle2, XCircle, Loader2, MessageSquare, Sparkles, type LucideIcon,
} from "lucide-react";

// ---------- types ----------
type StepKind = "task" | "approval" | "notification" | "condition" | "parallel" | "script" | "ai_action" | "wait";
type AssigneeKind = "submitter" | "manager" | "user" | "role" | "team";
type WorkflowStepDef = {
  key: string;
  name: string;
  kind: StepKind;
  assignee?: { kind: AssigneeKind; id?: string };
  due_in_minutes?: number;
  next?: string;
  on_approve?: string;
  on_reject?: string;
};
type WorkflowDef = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: "draft" | "published";
  current_version: number;
  trigger_type: string;
  definition: { steps: WorkflowStepDef[]; entry?: string };
};
type MyTask = {
  id: string;
  step_name: string;
  step_key: string;
  step_kind: string;
  started_at: string | null;
  due_at: string | null;
};
type Instance = {
  id: string;
  reference_code: string | null;
  workflow_name: string;
  starter_name: string | null;
  status: "running" | "completed" | "cancelled" | "draft";
};
type InstanceStep = { id: string; step_name: string; assigned_name: string | null; step_kind: string; status: string; comment?: string };
type InstanceComment = { id: string; author_name: string | null; created_at: string; body: string };
type InstanceDetail = {
  instance: { workflow_name: string; reference_code: string };
  steps: InstanceStep[];
  comments: InstanceComment[];
};
type EscalationRule = {
  id: string;
  name: string;
  workflow_id: string | null;
  step_key: string | null;
  trigger_after_min: number;
  action: string;
  active: boolean;
};

const STEP_KINDS: StepKind[] = ["task", "approval", "notification", "condition", "parallel", "script", "ai_action", "wait"];
const ESC_ACTIONS = ["notify", "reassign", "auto_approve", "auto_reject", "escalate_to"] as const;

// ---------- mock data ----------
const INITIAL_WORKFLOWS: WorkflowDef[] = [
  {
    id: "w1", key: "leave_approval", name: "اعتماد الإجازات", description: "سير عمل اعتماد طلبات الإجازة عبر المدير المباشر",
    status: "published", current_version: 2, trigger_type: "manual",
    definition: { steps: [
      { key: "submit", name: "تقديم الطلب", kind: "task", assignee: { kind: "submitter" }, next: "manager_approval" },
      { key: "manager_approval", name: "موافقة المدير", kind: "approval", assignee: { kind: "manager" }, due_in_minutes: 1440, on_approve: "hr_record", on_reject: "" },
      { key: "hr_record", name: "تسجيل الموارد البشرية", kind: "task", assignee: { kind: "role" } },
    ], entry: "submit" },
  },
  {
    id: "w2", key: "expense_review", name: "مراجعة المصروفات", description: "اعتماد صرف المستحقات المالية",
    status: "published", current_version: 1, trigger_type: "form_submission",
    definition: { steps: [
      { key: "finance_review", name: "مراجعة مالية", kind: "approval", assignee: { kind: "role" }, due_in_minutes: 2880 },
    ], entry: "finance_review" },
  },
  {
    id: "w3", key: "vendor_onboard", name: "اعتماد مورّد جديد", description: "إجراءات إضافة مورّد للنظام",
    status: "draft", current_version: 1, trigger_type: "manual",
    definition: { steps: [
      { key: "review", name: "مراجعة الوثائق", kind: "task" },
    ], entry: "review" },
  },
];

const INITIAL_MY_TASKS: MyTask[] = [
  { id: "t1", step_name: "موافقة المدير", step_key: "manager_approval", step_kind: "approval", started_at: "2026-06-15", due_at: "2026-06-20T12:00:00" },
  { id: "t2", step_name: "تسجيل الموارد البشرية", step_key: "hr_record", step_kind: "task", started_at: "2026-06-16", due_at: null },
  { id: "t3", step_name: "تحليل المستندات", step_key: "ai_analyze", step_kind: "ai_action", started_at: "2026-06-17", due_at: "2026-06-19T17:00:00" },
];

const INITIAL_INSTANCES: Instance[] = [
  { id: "i1", reference_code: "WF-2041", workflow_name: "اعتماد الإجازات", starter_name: "سعد العتيبي", status: "running" },
  { id: "i2", reference_code: "WF-2038", workflow_name: "مراجعة المصروفات", starter_name: "نورة القحطاني", status: "completed" },
  { id: "i3", reference_code: "WF-2035", workflow_name: "اعتماد مورّد جديد", starter_name: "خالد الدوسري", status: "cancelled" },
  { id: "i4", reference_code: "WF-2033", workflow_name: "اعتماد الإجازات", starter_name: "هند المطيري", status: "running" },
];

const INSTANCE_DETAILS: Record<string, InstanceDetail> = {
  i1: {
    instance: { workflow_name: "اعتماد الإجازات", reference_code: "WF-2041" },
    steps: [
      { id: "is1", step_name: "تقديم الطلب", assigned_name: "سعد العتيبي", step_kind: "task", status: "completed" },
      { id: "is2", step_name: "موافقة المدير", assigned_name: "محمد الراشد", step_kind: "approval", status: "pending", comment: "بانتظار مراجعة الرصيد المتبقي" },
      { id: "is3", step_name: "تسجيل الموارد البشرية", assigned_name: "—", step_kind: "task", status: "pending" },
    ],
    comments: [
      { id: "c1", author_name: "سعد العتيبي", created_at: "2026-06-15T09:00:00", body: "أرجو الموافقة على الإجازة السنوية." },
    ],
  },
  i2: {
    instance: { workflow_name: "مراجعة المصروفات", reference_code: "WF-2038" },
    steps: [
      { id: "is4", step_name: "مراجعة مالية", assigned_name: "القسم المالي", step_kind: "approval", status: "approved", comment: "تمت الموافقة على الصرف." },
    ],
    comments: [],
  },
  i3: {
    instance: { workflow_name: "اعتماد مورّد جديد", reference_code: "WF-2035" },
    steps: [
      { id: "is5", step_name: "مراجعة الوثائق", assigned_name: "خالد الدوسري", step_kind: "task", status: "rejected", comment: "نقص في المستندات المطلوبة." },
    ],
    comments: [],
  },
  i4: {
    instance: { workflow_name: "اعتماد الإجازات", reference_code: "WF-2033" },
    steps: [
      { id: "is6", step_name: "تقديم الطلب", assigned_name: "هند المطيري", step_kind: "task", status: "completed" },
      { id: "is7", step_name: "موافقة المدير", assigned_name: "محمد الراشد", step_kind: "approval", status: "pending" },
    ],
    comments: [],
  },
};

const INITIAL_RULES: EscalationRule[] = [
  { id: "r1", name: "تصعيد موافقة المدير", workflow_id: "w1", step_key: "manager_approval", trigger_after_min: 1440, action: "notify", active: true },
  { id: "r2", name: "تصعيد مراجعة المصروفات", workflow_id: "w2", step_key: "finance_review", trigger_after_min: 2880, action: "escalate_to", active: true },
  { id: "r3", name: "قاعدة عامة للمهام المتأخرة", workflow_id: null, step_key: null, trigger_after_min: 720, action: "reassign", active: false },
];

const DASHBOARD_STATS = {
  total_instances: 142,
  running: 23,
  completed: 108,
  cancelled: 11,
  my_open_tasks: 5,
  overdue_tasks: 3,
};

// ---------- inline UI helpers ----------
function Badge({ variant = "default", className, children }: { variant?: "default" | "outline" | "destructive" | "secondary"; className?: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    default: "bg-primary text-primary-foreground",
    outline: "border border-border text-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    secondary: "bg-secondary text-secondary-foreground",
  };
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", map[variant], className)}>{children}</span>;
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={cn("text-sm font-medium leading-none", className)}>{children}</label>;
}

function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span className={cn("inline-block size-5 transform rounded-full bg-background shadow transition-transform", checked ? "translate-x-0.5" : "translate-x-[1.375rem]")} />
    </button>
  );
}

function NativeSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ---------- page ----------
type TabKey = "my-tasks" | "instances" | "workflows" | "escalations";

export default function WorkflowsPage() {
  const [tab, setTab] = useState<TabKey>("my-tasks");
  const tabs: { key: TabKey; label: string; Icon: LucideIcon }[] = [
    { key: "my-tasks", label: "مهامي", Icon: Inbox },
    { key: "instances", label: "المعاملات", Icon: BarChart3 },
    { key: "workflows", label: "التصاميم", Icon: Workflow },
    { key: "escalations", label: "التصعيد", Icon: AlertTriangle },
  ];
  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <DashboardCards />
      <div className="space-y-6">
        <div className="grid grid-cols-5 w-full max-w-4xl rounded-lg bg-muted p-1 text-muted-foreground">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                tab === key ? "bg-background text-foreground shadow" : "hover:text-foreground",
              )}
            >
              <Icon className="size-4 ms-2" />{label}
            </button>
          ))}
        </div>
        {tab === "my-tasks" && <MyTasksTab />}
        {tab === "instances" && <InstancesTab />}
        {tab === "workflows" && <WorkflowDesignerTab />}
        {tab === "escalations" && <EscalationsTab />}
      </div>
    </div>
  );
}

function DashboardCards() {
  const data = DASHBOARD_STATS;
  const items: { label: string; value: number; icon: LucideIcon; color?: string }[] = [
    { label: "إجمالي المعاملات", value: data.total_instances, icon: BarChart3 },
    { label: "قيد التنفيذ", value: data.running, icon: Play, color: "text-blue-500" },
    { label: "مكتملة", value: data.completed, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "ملغاة", value: data.cancelled, icon: XCircle, color: "text-rose-500" },
    { label: "مهامي المفتوحة", value: data.my_open_tasks, icon: Inbox, color: "text-primary" },
    { label: "متأخرة", value: data.overdue_tasks, icon: AlertTriangle, color: "text-amber-500" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.label} className="mulki-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`size-4 ${it.color ?? ""}`} />{it.label}</div>
            <div className="font-display text-2xl font-semibold mt-1">{it.value}</div>
          </Card>
        );
      })}
    </div>
  );
}

function MyTasksTab() {
  const [tasks, setTasks] = useState<MyTask[]>(INITIAL_MY_TASKS);
  const [aiPending, setAiPending] = useState<string | null>(null);

  const act = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast.success("تم تنفيذ الإجراء");
  };
  const runAi = (id: string) => {
    setAiPending(id);
    setTimeout(() => {
      setAiPending(null);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success(`تم تشغيل الذكاء (${Math.floor(200 + Math.random() * 800)}ms)`);
    }, 700);
  };

  return (
    <Card className="mulki-card p-6">
      <h2 className="font-display text-xl font-semibold mb-4">مهامي قيد التنفيذ</h2>
      <div className="w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b border-border">
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الخطوة</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">النوع</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">التاريخ</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الاستحقاق</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {tasks.length === 0 && <tr className="border-b border-border"><td colSpan={5} className="text-center text-muted-foreground py-8">لا توجد مهام معلّقة.</td></tr>}
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-border">
                <td className="p-2 align-middle"><div className="font-medium">{t.step_name}</div><div className="text-xs text-muted-foreground font-mono">{t.step_key}</div></td>
                <td className="p-2 align-middle"><Badge variant="outline">{t.step_kind}</Badge></td>
                <td className="p-2 align-middle text-xs text-muted-foreground">{t.started_at ? new Date(t.started_at).toLocaleDateString("ar-SA") : "—"}</td>
                <td className="p-2 align-middle text-xs">{t.due_at ? new Date(t.due_at).toLocaleString("ar-SA") : "—"}</td>
                <td className="p-2 align-middle text-end space-x-1 space-x-reverse">
                  {t.step_kind === "approval" ? (
                    <>
                      <Button size="sm" onClick={() => act(t.id)}>قبول</Button>
                      <Button size="sm" variant="outline" onClick={() => act(t.id)}>رفض</Button>
                    </>
                  ) : t.step_kind === "ai_action" ? (
                    <Button size="sm" className="gap-1" disabled={aiPending === t.id} onClick={() => runAi(t.id)}>
                      {aiPending === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      تشغيل الذكاء
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => act(t.id)}>إنجاز</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InstancesTab() {
  const rows = INITIAL_INSTANCES;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = selectedId ? INSTANCE_DETAILS[selectedId] : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="mulki-card p-6">
        <h2 className="font-display text-xl font-semibold mb-4">المعاملات الجارية</h2>
        <div className="w-full overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b border-border">
                <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">المرجع</th>
                <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الإجراء</th>
                <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">المُنشئ</th>
                <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الحالة</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {rows.length === 0 && <tr className="border-b border-border"><td colSpan={4} className="text-center text-muted-foreground py-8">لا معاملات.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border cursor-pointer hover:bg-muted/40" onClick={() => setSelectedId(r.id)}>
                  <td className="p-2 align-middle font-mono text-xs">{r.reference_code ?? r.id.slice(0, 8)}</td>
                  <td className="p-2 align-middle">{r.workflow_name}</td>
                  <td className="p-2 align-middle text-sm">{r.starter_name ?? "—"}</td>
                  <td className="p-2 align-middle"><Badge variant={r.status === "completed" ? "default" : r.status === "running" ? "secondary" : r.status === "cancelled" ? "destructive" : "outline"}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="mulki-card p-6">
        {!selectedId ? (
          <p className="text-center text-muted-foreground py-12">اختر معاملة لعرض تفاصيلها.</p>
        ) : !detail ? <Loader2 className="size-6 mx-auto animate-spin" /> : (
          <>
            <h3 className="font-display text-lg font-semibold mb-1">{detail.instance.workflow_name}</h3>
            <div className="text-xs text-muted-foreground mb-4 font-mono">{detail.instance.reference_code}</div>
            <div className="space-y-2 mb-4">
              {detail.steps.map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{s.step_name}</div>
                      <div className="text-xs text-muted-foreground">{s.assigned_name ?? "—"} • {s.step_kind}</div>
                    </div>
                    <Badge variant={s.status === "approved" || s.status === "completed" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>{s.status}</Badge>
                  </div>
                  {s.comment && <p className="text-sm text-muted-foreground mt-2 border-s-2 border-primary ps-2">{s.comment}</p>}
                </div>
              ))}
            </div>
            <CommentsBlock comments={detail.comments} />
          </>
        )}
      </Card>
    </div>
  );
}

function CommentsBlock({ comments }: { comments: InstanceComment[] }) {
  const [list, setList] = useState<InstanceComment[]>(comments);
  const [body, setBody] = useState("");
  const add = () => {
    if (!body) return;
    setList((prev) => [...prev, { id: `c${Date.now()}`, author_name: "مدير المكتب", created_at: new Date().toISOString(), body }]);
    setBody("");
  };
  return (
    <div className="border-t border-border pt-4 mt-4">
      <h4 className="text-sm font-medium flex items-center gap-2 mb-2"><MessageSquare className="size-4" />التعليقات</h4>
      <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
        {list.length === 0 && <p className="text-xs text-muted-foreground">لا تعليقات.</p>}
        {list.map((c) => (
          <div key={c.id} className="text-sm rounded-lg bg-muted/40 p-2">
            <div className="text-xs text-muted-foreground">{c.author_name ?? "—"} • {new Date(c.created_at).toLocaleString("ar-SA")}</div>
            <div>{c.body}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="أضف تعليقًا…" />
        <Button onClick={add} disabled={!body}>إرسال</Button>
      </div>
    </div>
  );
}

type WfEditState = { id?: string; key: string; name: string; description: string; steps: WorkflowStepDef[]; trigger_type: string };

function WorkflowDesignerTab() {
  const [wfs, setWfs] = useState<WorkflowDef[]>(INITIAL_WORKFLOWS);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<WfEditState>({ key: "", name: "", description: "", steps: [], trigger_type: "manual" });

  const save = () => {
    if (!edit.name) { toast.error("الاسم مطلوب"); return; }
    setWfs((prev) => {
      if (edit.id) {
        return prev.map((w) => (w.id === edit.id ? { ...w, key: edit.key, name: edit.name, description: edit.description || null, trigger_type: edit.trigger_type, definition: { steps: edit.steps, entry: edit.steps[0]?.key } } : w));
      }
      return [...prev, { id: `w${Date.now()}`, key: edit.key, name: edit.name, description: edit.description || null, status: "draft", current_version: 1, trigger_type: edit.trigger_type, definition: { steps: edit.steps, entry: edit.steps[0]?.key } }];
    });
    toast.success("تم");
    setOpen(false);
  };
  const publish = (id: string) => { setWfs((prev) => prev.map((w) => (w.id === id ? { ...w, status: "published" } : w))); toast.success("تم النشر"); };
  const del = (id: string) => setWfs((prev) => prev.filter((w) => w.id !== id));
  const start = () => { toast.success(`بدأت • WF-${Math.floor(2000 + Math.random() * 999)}`); };

  const addStep = () => setEdit({
    ...edit,
    steps: [...edit.steps, { key: `step_${edit.steps.length + 1}`, name: "خطوة جديدة", kind: "task" }],
  });
  const updateStep = (i: number, patch: Partial<WorkflowStepDef>) => {
    const next = [...edit.steps]; next[i] = { ...next[i], ...patch }; setEdit({ ...edit, steps: next });
  };
  const removeStep = (i: number) => setEdit({ ...edit, steps: edit.steps.filter((_, idx) => idx !== i) });

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">تصاميم سير العمل</h2>
        <Button onClick={() => { setEdit({ key: "", name: "", description: "", steps: [], trigger_type: "manual" }); setOpen(true); }}><Plus className="size-4 ms-2" />سير عمل جديد</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.id ? "تعديل" : "سير عمل جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>الاسم</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                <div><Label>المعرّف</Label><Input value={edit.key} onChange={(e) => setEdit({ ...edit, key: e.target.value })} placeholder="leave_approval" /></div>
                <div><Label>المُحفّز</Label>
                  <NativeSelect value={edit.trigger_type} onChange={(v) => setEdit({ ...edit, trigger_type: v })}
                    options={["manual", "form_submission", "schedule", "event", "webhook"].map((t) => ({ value: t, label: t }))} />
                </div>
              </div>
              <div><Label>الوصف</Label><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div>
                <div className="flex items-center justify-between mb-2"><Label>الخطوات</Label><Button size="sm" variant="outline" onClick={addStep}><Plus className="size-3 ms-1" />خطوة</Button></div>
                <div className="space-y-2">
                  {edit.steps.map((s, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3"><Label className="text-xs">المعرّف</Label><Input value={s.key} onChange={(e) => updateStep(i, { key: e.target.value })} /></div>
                        <div className="col-span-3"><Label className="text-xs">الاسم</Label><Input value={s.name} onChange={(e) => updateStep(i, { name: e.target.value })} /></div>
                        <div className="col-span-2"><Label className="text-xs">النوع</Label>
                          <NativeSelect value={s.kind} onChange={(v) => updateStep(i, { kind: v as StepKind })}
                            options={STEP_KINDS.map((k) => ({ value: k, label: k }))} />
                        </div>
                        <div className="col-span-2"><Label className="text-xs">المسؤول</Label>
                          <NativeSelect value={s.assignee?.kind ?? "_none"} onChange={(v) => updateStep(i, { assignee: v === "_none" ? undefined : { kind: v as AssigneeKind } })}
                            options={[
                              { value: "_none", label: "—" },
                              { value: "submitter", label: "المُقدِّم" },
                              { value: "manager", label: "المدير" },
                              { value: "user", label: "مستخدم" },
                              { value: "role", label: "دور" },
                              { value: "team", label: "فريق" },
                            ]} />
                        </div>
                        <div className="col-span-1"><Label className="text-xs">دقائق</Label><Input type="number" value={s.due_in_minutes ?? ""} onChange={(e) => updateStep(i, { due_in_minutes: e.target.value ? Number(e.target.value) : undefined })} /></div>
                        <div className="col-span-1 flex items-end"><Button size="icon" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="size-4 text-destructive" /></Button></div>
                      </div>
                      {s.kind === "approval" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">عند القبول → خطوة</Label><Input value={s.on_approve ?? ""} onChange={(e) => updateStep(i, { on_approve: e.target.value || undefined })} /></div>
                          <div><Label className="text-xs">عند الرفض → خطوة</Label><Input value={s.on_reject ?? ""} onChange={(e) => updateStep(i, { on_reject: e.target.value || undefined })} /></div>
                        </div>
                      ) : (
                        <div><Label className="text-xs">الخطوة التالية</Label><Input value={s.next ?? ""} onChange={(e) => updateStep(i, { next: e.target.value || undefined })} /></div>
                      )}
                      {(s.assignee?.kind === "user" || s.assignee?.kind === "role" || s.assignee?.kind === "team") && (
                        <div><Label className="text-xs">UUID المسؤول</Label><Input value={s.assignee?.id ?? ""} onChange={(e) => updateStep(i, { assignee: { kind: s.assignee!.kind, id: e.target.value } })} /></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {wfs.length === 0 && <Card className="p-8 text-center text-muted-foreground md:col-span-2">لا توجد تصاميم.</Card>}
        {wfs.map((w) => (
          <Card key={w.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{w.key} • v{w.current_version} • {w.trigger_type}</div>
              </div>
              <Badge variant={w.status === "published" ? "default" : "secondary"}>{w.status}</Badge>
            </div>
            {w.description && <p className="text-sm text-muted-foreground mt-2">{w.description}</p>}
            <div className="text-xs text-muted-foreground mt-2">{(w.definition?.steps ?? []).length} خطوات</div>
            <div className="flex gap-1 mt-3 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => { setEdit({ id: w.id, key: w.key, name: w.name, description: w.description ?? "", steps: w.definition?.steps ?? [], trigger_type: w.trigger_type }); setOpen(true); }}>تعديل</Button>
              <Button size="sm" variant="outline" onClick={() => publish(w.id)}><Upload className="size-3 ms-1" />نشر</Button>
              {w.status === "published" && w.trigger_type === "manual" && (
                <Button size="sm" onClick={start}><Play className="size-3 ms-1" />بدء</Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => del(w.id)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}

function EscalationsTab() {
  const [rules, setRules] = useState<EscalationRule[]>(INITIAL_RULES);
  const wfs = INITIAL_WORKFLOWS;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ workflow_id: string; step_key: string; name: string; trigger_after_min: number; action: (typeof ESC_ACTIONS)[number]; active: boolean }>({
    workflow_id: "", step_key: "", name: "", trigger_after_min: 60, action: "notify", active: true,
  });

  const save = () => {
    if (!f.name) { toast.error("الاسم مطلوب"); return; }
    setRules((prev) => [...prev, { id: `r${Date.now()}`, name: f.name, workflow_id: f.workflow_id || null, step_key: f.step_key || null, trigger_after_min: Number(f.trigger_after_min), action: f.action, active: f.active }]);
    toast.success("تم");
    setOpen(false);
    setF({ workflow_id: "", step_key: "", name: "", trigger_after_min: 60, action: "notify", active: true });
  };
  const del = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id));
  const scan = () => toast.success(`تم تصعيد ${Math.floor(Math.random() * 4)} خطوة متأخرة`);

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">قواعد التصعيد</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={scan}><AlertTriangle className="size-4 ms-2" />تشغيل الفحص</Button>
          <Button onClick={() => setOpen(true)}><Plus className="size-4 ms-2" />قاعدة</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>قاعدة تصعيد</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>الاسم</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div><Label>سير العمل (اختياري)</Label>
                  <NativeSelect value={f.workflow_id || "_any"} onChange={(v) => setF({ ...f, workflow_id: v === "_any" ? "" : v })}
                    options={[{ value: "_any", label: "— أي —" }, ...wfs.map((w) => ({ value: w.id, label: w.name }))]} />
                </div>
                <div><Label>معرّف الخطوة (اختياري)</Label><Input value={f.step_key} onChange={(e) => setF({ ...f, step_key: e.target.value })} /></div>
                <div><Label>التأخير بالدقائق</Label><Input type="number" value={f.trigger_after_min} onChange={(e) => setF({ ...f, trigger_after_min: Number(e.target.value) })} /></div>
                <div><Label>الإجراء</Label>
                  <NativeSelect value={f.action} onChange={(v) => setF({ ...f, action: v as (typeof ESC_ACTIONS)[number] })}
                    options={ESC_ACTIONS.map((a) => ({ value: a, label: a }))} />
                </div>
                <div className="flex items-center gap-2"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /><Label>فعّالة</Label></div>
              </div>
              <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b border-border">
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الاسم</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">سير العمل</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">دقائق</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الإجراء</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الحالة</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {rules.length === 0 && <tr className="border-b border-border"><td colSpan={6} className="text-center text-muted-foreground py-8">لا قواعد.</td></tr>}
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="p-2 align-middle">{r.name}</td>
                <td className="p-2 align-middle text-xs">{wfs.find((w) => w.id === r.workflow_id)?.name ?? "— أي —"}</td>
                <td className="p-2 align-middle">{r.trigger_after_min}</td>
                <td className="p-2 align-middle"><Badge variant="outline">{r.action}</Badge></td>
                <td className="p-2 align-middle"><Badge variant={r.active ? "default" : "secondary"}>{r.active ? "فعّالة" : "موقوفة"}</Badge></td>
                <td className="p-2 align-middle"><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
