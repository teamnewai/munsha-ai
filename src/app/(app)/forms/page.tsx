"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus, Trash2, Upload, Inbox, Loader2, Check } from "lucide-react";

// ---------- types ----------
type FieldType = "text" | "textarea" | "number" | "email" | "date" | "select" | "multiselect" | "checkbox" | "file";
type FieldOption = { value: string; label: string };
type FormField = { key: string; label: string; type: FieldType; required?: boolean; options?: FieldOption[]; helperText?: string };
type FormDef = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  current_version: number;
  schema: { fields: FormField[] };
};
type Submission = {
  id: string;
  reference_code: string | null;
  form_name: string;
  form_version: number;
  submitter_name: string | null;
  status: "submitted" | "in_review" | "approved" | "rejected";
  created_at: string;
};

const FIELD_TYPES: FieldType[] = ["text", "textarea", "number", "email", "date", "select", "multiselect", "checkbox", "file"];

// ---------- mock data ----------
const INITIAL_FORMS: FormDef[] = [
  {
    id: "f1", key: "leave_request", name: "طلب إجازة", description: "نموذج التقديم على الإجازات السنوية والاضطرارية",
    status: "published", current_version: 3,
    schema: { fields: [
      { key: "leave_type", label: "نوع الإجازة", type: "select", required: true, options: [{ value: "annual", label: "سنوية" }, { value: "sick", label: "مرضية" }] },
      { key: "start_date", label: "تاريخ البداية", type: "date", required: true },
      { key: "days", label: "عدد الأيام", type: "number", required: true },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ] },
  },
  {
    id: "f2", key: "expense_claim", name: "صرف مستحقات", description: "المطالبة بصرف المصروفات والمستحقات المالية",
    status: "published", current_version: 2,
    schema: { fields: [
      { key: "amount", label: "المبلغ", type: "number", required: true },
      { key: "reason", label: "السبب", type: "textarea", required: true },
    ] },
  },
  {
    id: "f3", key: "internal_memo", name: "مخاطبة داخلية", description: "نموذج المراسلات الداخلية بين الأقسام",
    status: "draft", current_version: 1,
    schema: { fields: [
      { key: "to_dept", label: "إلى القسم", type: "text", required: true },
      { key: "subject", label: "الموضوع", type: "text", required: true },
      { key: "body", label: "المحتوى", type: "textarea", required: true },
    ] },
  },
];

const INITIAL_SUBMISSIONS: Submission[] = [
  { id: "sub1", reference_code: "FRM-1042", form_name: "طلب إجازة", form_version: 3, submitter_name: "سعد العتيبي", status: "submitted", created_at: "2026-06-10" },
  { id: "sub2", reference_code: "FRM-1041", form_name: "صرف مستحقات", form_version: 2, submitter_name: "نورة القحطاني", status: "in_review", created_at: "2026-06-08" },
  { id: "sub3", reference_code: "FRM-1039", form_name: "طلب إجازة", form_version: 3, submitter_name: "خالد الدوسري", status: "approved", created_at: "2026-06-05" },
  { id: "sub4", reference_code: "FRM-1037", form_name: "مخاطبة داخلية", form_version: 1, submitter_name: "هند المطيري", status: "rejected", created_at: "2026-06-02" },
];

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

function Checkbox({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "size-4 shrink-0 rounded border border-border grid place-items-center transition-colors",
        checked ? "bg-primary border-primary text-primary-foreground" : "bg-transparent",
      )}
    >
      {checked && <Check className="size-3" />}
    </button>
  );
}

function NativeSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder?: string; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ---------- page ----------
type TabKey = "forms" | "submissions";

export default function FormsPage() {
  const [tab, setTab] = useState<TabKey>("forms");
  const tabs: { key: TabKey; label: string; Icon: typeof FileText }[] = [
    { key: "forms", label: "النماذج", Icon: FileText },
    { key: "submissions", label: "التقديمات", Icon: Inbox },
  ];
  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="space-y-6">
        <div className="grid grid-cols-2 w-full max-w-md rounded-lg bg-muted p-1 text-muted-foreground">
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
        {tab === "forms" && <FormsTab />}
        {tab === "submissions" && <SubmissionsTab />}
      </div>
    </div>
  );
}

type EditState = { id?: string; key: string; name: string; description: string; fields: FormField[] };

function FormsTab() {
  const [forms, setForms] = useState<FormDef[]>(INITIAL_FORMS);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<EditState>({ key: "", name: "", description: "", fields: [] });
  const [submitOpen, setSubmitOpen] = useState<string | null>(null);

  const save = () => {
    if (!edit.name) { toast.error("الاسم مطلوب"); return; }
    setForms((prev) => {
      if (edit.id) {
        return prev.map((f) => (f.id === edit.id ? { ...f, key: edit.key, name: edit.name, description: edit.description || null, schema: { fields: edit.fields } } : f));
      }
      return [...prev, { id: `f${Date.now()}`, key: edit.key, name: edit.name, description: edit.description || null, status: "draft", current_version: 1, schema: { fields: edit.fields } }];
    });
    toast.success("تم الحفظ");
    setEditOpen(false);
  };
  const publish = (id: string) => { setForms((prev) => prev.map((f) => (f.id === id ? { ...f, status: "published" } : f))); toast.success("تم النشر"); };
  const del = (id: string) => setForms((prev) => prev.filter((f) => f.id !== id));

  const addField = () => setEdit({
    ...edit,
    fields: [...edit.fields, { key: `field_${edit.fields.length + 1}`, label: "حقل جديد", type: "text", required: false }],
  });
  const updateField = (i: number, patch: Partial<FormField>) => {
    const next = [...edit.fields]; next[i] = { ...next[i], ...patch }; setEdit({ ...edit, fields: next });
  };
  const removeField = (i: number) => setEdit({ ...edit, fields: edit.fields.filter((_, idx) => idx !== i) });

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">النماذج</h2>
        <Button onClick={() => { setEdit({ key: "", name: "", description: "", fields: [] }); setEditOpen(true); }}><Plus className="size-4 ms-2" />نموذج جديد</Button>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.id ? "تعديل النموذج" : "نموذج جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الاسم</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                <div><Label>المعرّف (key)</Label><Input value={edit.key} onChange={(e) => setEdit({ ...edit, key: e.target.value })} placeholder="leave_request" /></div>
              </div>
              <div><Label>الوصف</Label><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>الحقول</Label>
                  <Button size="sm" variant="outline" onClick={addField}><Plus className="size-3 ms-1" />حقل</Button>
                </div>
                <div className="space-y-2">
                  {edit.fields.map((f, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3"><Label className="text-xs">المعرّف</Label><Input value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} /></div>
                      <div className="col-span-3"><Label className="text-xs">التسمية</Label><Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} /></div>
                      <div className="col-span-2"><Label className="text-xs">النوع</Label>
                        <NativeSelect value={f.type} onChange={(v) => updateField(i, { type: v as FieldType })}
                          options={FIELD_TYPES.map((t) => ({ value: t, label: t }))} />
                      </div>
                      <div className="col-span-3">
                        {(f.type === "select" || f.type === "multiselect") && (
                          <Input placeholder="value:label, value:label" value={(f.options ?? []).map((o) => `${o.value}:${o.label}`).join(",")}
                            onChange={(e) => updateField(i, { options: e.target.value.split(",").filter(Boolean).map((s) => { const [v, l] = s.split(":"); return { value: v.trim(), label: (l ?? v).trim() }; }) })} />
                        )}
                      </div>
                      <div className="col-span-1 flex items-center gap-2">
                        <Checkbox checked={!!f.required} onCheckedChange={(v) => updateField(i, { required: v })} />
                        <Button size="icon" variant="ghost" onClick={() => removeField(i)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
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
        {forms.length === 0 && <Card className="p-8 text-center text-muted-foreground md:col-span-2">لا توجد نماذج.</Card>}
        {forms.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{f.key} • v{f.current_version}</div>
              </div>
              <Badge variant={f.status === "published" ? "default" : f.status === "draft" ? "secondary" : "outline"}>{f.status}</Badge>
            </div>
            {f.description && <p className="text-sm text-muted-foreground mt-2">{f.description}</p>}
            <div className="text-xs text-muted-foreground mt-2">{(f.schema?.fields ?? []).length} حقول</div>
            <div className="flex gap-1 mt-3 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => { setEdit({ id: f.id, key: f.key, name: f.name, description: f.description ?? "", fields: f.schema?.fields ?? [] }); setEditOpen(true); }}>تعديل</Button>
              <Button size="sm" variant="outline" onClick={() => publish(f.id)}><Upload className="size-3 ms-1" />نشر</Button>
              {f.status === "published" && <Button size="sm" onClick={() => setSubmitOpen(f.id)}>تقديم</Button>}
              <Button size="icon" variant="ghost" onClick={() => del(f.id)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          </Card>
        ))}
      </div>
      <SubmitDialog open={submitOpen} onClose={() => setSubmitOpen(null)} forms={forms} />
    </Card>
  );
}

function SubmitDialog({ open, onClose, forms }: { open: string | null; onClose: () => void; forms: FormDef[] }) {
  const form = forms.find((f) => f.id === open);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [pending, setPending] = useState(false);

  const submit = () => {
    setPending(true);
    setTimeout(() => {
      const ref = `FRM-${Math.floor(1000 + Math.random() * 9000)}`;
      toast.success(`تم التقديم • ${ref}`);
      setPending(false);
      onClose();
      setValues({});
    }, 600);
  };

  if (!form) return null;
  return (
    <Dialog open={!!open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>تقديم: {form.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {(form.schema?.fields ?? []).map((f) => (
            <div key={f.key}>
              <Label>{f.label}{f.required && <span className="text-destructive ms-1">*</span>}</Label>
              {f.type === "textarea" ? (
                <Textarea value={(values[f.key] as string) ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              ) : f.type === "select" ? (
                <NativeSelect value={(values[f.key] as string) ?? ""} onChange={(v) => setValues({ ...values, [f.key]: v })}
                  placeholder="—" options={(f.options ?? []).map((o) => ({ value: o.value, label: o.label }))} />
              ) : f.type === "checkbox" ? (
                <div className="pt-1"><Checkbox checked={!!values[f.key]} onCheckedChange={(v) => setValues({ ...values, [f.key]: v })} /></div>
              ) : (
                <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
                  value={(values[f.key] as string) ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              )}
              {f.helperText && <p className="text-xs text-muted-foreground mt-1">{f.helperText}</p>}
            </div>
          ))}
        </div>
        <DialogFooter><Button onClick={submit} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin ms-2" />}تقديم</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionsTab() {
  const [rows, setRows] = useState<Submission[]>(INITIAL_SUBMISSIONS);
  const setStatus = (id: string, status: Submission["status"]) => {
    setRows((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    toast.success("تم");
  };
  return (
    <Card className="mulki-card p-6">
      <h2 className="font-display text-xl font-semibold mb-4">التقديمات</h2>
      <div className="w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b border-border">
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">المرجع</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">النموذج</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">المُقدِّم</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الحالة</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">التاريخ</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {rows.length === 0 && <tr className="border-b border-border"><td colSpan={6} className="text-center text-muted-foreground py-8">لا توجد تقديمات.</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border">
                <td className="p-2 align-middle font-mono text-xs">{s.reference_code ?? s.id.slice(0, 8)}</td>
                <td className="p-2 align-middle">{s.form_name} <span className="text-xs text-muted-foreground">v{s.form_version}</span></td>
                <td className="p-2 align-middle">{s.submitter_name ?? "—"}</td>
                <td className="p-2 align-middle"><Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>{s.status}</Badge></td>
                <td className="p-2 align-middle text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("ar-SA")}</td>
                <td className="p-2 align-middle text-end">
                  {["submitted", "in_review"].includes(s.status) && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "approved")}>قبول</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(s.id, "rejected")}>رفض</Button>
                    </>
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
